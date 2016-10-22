// Requires jquery and must be on a page with access to the background page

// MyFilters class manages subscriptions and the FilterSet.

// Constructor: merge the stored subscription data and the total possible
// list of subscriptions into this._subscriptions.  Store to disk.
// Inputs: none.
const HOUR_IN_MS = 1000 * 60 * 60;

class MyFilters {
    constructor() {
        this._subscriptions = storage_get("filter_lists");
        this._official_options = this._make_subscription_options();
    }

    // Update _subscriptions and _official_options in case there are changes.
    // Should be invoked right after creating a MyFilters object.
    init() {
        var newUser = !this._subscriptions;
        this._updateDefaultSubscriptions();
        this._updateFieldsFromOriginalOptions();

        // Build the filter list
        this._onSubscriptionChange(true);

        // On startup and then every hour, check if a list is out of date and has to
        // be updated
        var that = this;
        if (newUser) {
            this.checkFilterUpdates();
        } else {
            idleHandler.scheduleItemOnce(
                function() {
                    that.checkFilterUpdates();
                },
                60
            );
        }

        window.setInterval(
            function() {
                idleHandler.scheduleItemOnce(function() {
                    that.checkFilterUpdates();
                });
            },
            60 * 60 * 1000
        );
    }

    // Update the url and requiresList for entries in _subscriptions using values from _official_options.
    _updateFieldsFromOriginalOptions() {
        // Use the stored properties, and only add any new properties and/or lists
        // if they didn't exist in this._subscriptions
        for (var id in this._official_options) {
            if (!this._subscriptions[id]) {
                this._subscriptions[id] = {};
            }
            var sub = this._subscriptions[id];
            var official = this._official_options[id];

            sub.initialUrl = sub.initialUrl || official.url;
            sub.url = sub.url || official.url;
            if (sub.initialUrl !== official.url) {
                // The official URL was changed. Use it. In case of a redirect, this
                // doesn't happen as only sub.url is changed, not sub.initialUrl.
                sub.initialUrl = official.url;
                sub.url = official.url;
            }
            if (official.safariJSON_URL) {
                sub.safariJSON_URL = official.safariJSON_URL;
            }

            var isMissingRequiredList = (sub.requiresList !== official.requiresList);
            if (official.requiresList && isMissingRequiredList && sub.subscribed) {
                // A required list was added.  Make sure main list subscribers get it.
                if (this._subscriptions[official.requiresList]) {
                    this.changeSubscription(official.requiresList, { subscribed: true });
                }
            }
            sub.requiresList = official.requiresList;
            sub.subscribed = sub.subscribed || false;
        }
    }

    // Update default subscriptions in the browser storage.
    // Removes subscriptions that are no longer in the official list, not user submitted and no longer subscribed.
    // Also, converts user submitted subscriptions to recognized one if it is already added to the official list
    // and vice-versa.
    _updateDefaultSubscriptions() {
        if (!this._subscriptions) {
            // Brand new user. Install some filters for them.
            this._subscriptions = this._load_default_subscriptions();
            return;
        }

        // Function that will add a new entry with updated id,
        // and will remove old entry with outdated id.
        var that = this;
        function renameSubscription(old_id, new_id) {
            that._subscriptions[new_id] = that._subscriptions[old_id];
            delete that._subscriptions[old_id];
        }

        for (var id in this._subscriptions) {
            // Delete unsubscribed ex-official lists.
            if (!this._official_options[id] && !this._subscriptions[id].user_submitted &&
                !this._subscriptions[id].subscribed) {
                delete this._subscriptions[id];
            }
            // Convert subscribed ex-official lists into user-submitted lists.
            // Convert subscribed ex-user-submitted lists into official lists.
            else {
                // Cache subscription that needs to be checked.
                var sub_to_check = this._subscriptions[id];
                var is_user_submitted = true;
                var update_id = id;
                if (!this._official_options[id]) {
                    // If id is not in official options, check if there's a matching url in the
                    // official list. If there is, then the subscription is not user submitted.
                    for (var official_id in this._official_options) {
                        var official_url = this._official_options[official_id].url;
                        if (sub_to_check.initialUrl === official_url ||
                            sub_to_check.url === official_url) {
                            is_user_submitted = false;
                            update_id = official_id;
                            break;
                        }
                    }
                } else {
                    is_user_submitted = false;
                }

                sub_to_check.user_submitted = is_user_submitted;

                // Create new id and check if new id is the same as id.
                // If not, update entry in subscriptions.
                var new_id = is_user_submitted ? ("url:" + sub_to_check.url) : update_id;

                if (new_id !== id) {
                    renameSubscription(id, new_id);
                }
            }
        }
    }

    // When a subscription property changes, this function stores it
    // Inputs: rebuild? boolean, true if the filterset should be rebuilt.
    _onSubscriptionChange(rebuild) {
        storage_set("filter_lists", this._subscriptions);

        // The only reasons to (re)build the filter set are
        // - when AdBlock starts
        // - when a filter list text is changed ([un]subscribed or updated a list)
        if (rebuild) {
            this.rebuild();
        }

        chrome.runtime.sendMessage({ command: "filters_updated" });
    }

    // Get filters that are defined in the extension.
    getExtensionFilters(settings) {
        var texts = [];
        if (settings.whitelist_hulu_ads) {
            // Issue 7178: FilterNormalizer removes EasyList's too-broad Hulu whitelist
            // entries.  If the user enables whitelist_hulu_ads, just add them back.
            // This workaround can be removed when EasyList changes its Hulu strategy.
            texts.push("@@||ads.hulu.com/published/*.flv");
            texts.push("@@||ads.hulu.com/published/*.mp4");
            texts.push("@@||ll.a.hulu.com/published/*.flv");
            texts.push("@@||ll.a.hulu.com/published/*.mp4");
        }

        return texts;
    }

    // Rebuild filters based on the current settings and subscriptions.
    rebuild() {
        var texts = [];
        if (!get_settings().safari_content_blocking) {
            // Only add subscriptions in Chrome, Opera, and older version of Safari...
            for (var id in this._subscriptions) {
                if (this._subscriptions[id].subscribed) {
                    texts.push(this._subscriptions[id].text);
                }
            }

            // Include custom filters.
            var customfilters = storage_get("custom_filters") || ""; // from background
            if (customfilters) {
                texts.push(FilterNormalizer.normalizeList(customfilters));
            }

            texts = texts.concat(this.getExtensionFilters(get_settings()));
            texts = texts.join("\n").split("\n");
            var filters = this._splitByType(texts);

            this.hiding = FilterSet.fromFilters(filters.hiding);

            this.blocking = new BlockingFilterSet(
                FilterSet.fromFilters(filters.pattern),
                FilterSet.fromFilters(filters.whitelist)
            );

            if (typeof handlerBehaviorChanged === "function") {
                handlerBehaviorChanged(); // defined in background
            }

            // If the user is subscribed to malware, then get it
            if (this._subscriptions &&
                this._subscriptions.malware &&
                this._subscriptions.malware.subscribed &&
                !this.getMalwareDomains()) {
                this._initializeMalwareDomains();
            }
        } else {
            // If Safari 9 content blocking
            var filterListRules = [];
            for (var id in this._subscriptions) {
                if (this._subscriptions[id].subscribed) {
                    for (var item in this._subscriptions[id].rules) {
                        filterListRules.push(this._subscriptions[id].rules[item]);
                    }
                }
            }

            if (this._subscriptions &&
                this._subscriptions.malware &&
                this._subscriptions.malware.subscribed &&
                this.getMalwareDomains()) {
                var malwareDomains = this._subscriptions.malware.text.adware;
                var malwareRules = DeclarativeWebRequest.convertMalware(malwareDomains);
                //add the custom rules, with the filter list rules
                for (var i = 0; i < malwareRules.length; i++) {
                    filterListRules.push(malwareRules[i]);
                }
            }

            // Include custom filters.
            var customfilters = get_custom_filters_text(); // from background
            if (customfilters) {
                texts.push(FilterNormalizer.normalizeList(customfilters));
                texts = texts.join("\n").split("\n");
                var filters = this._splitByType(texts);
                var patternFilters = [];
                for (var id in filters.pattern) {
                    patternFilters.push(filters.pattern[id]);
                }
                var whitelistFilters = [];
                for (var id in filters.whitelist) {
                    whitelistFilters.push(filters.whitelist[id]);
                }
                // SelectorFilters where full() === True are selectors that apply to all domains, no exceptions
                // these filters can be collapsed into a few large JSON rules
                // SelectorFilters where full() === False are selectors that either:
                //    - apply to specific domain(s)
                //    - or have exceptions domains, where the selectors are not applied
                var selectorsFull = {};
                var selectorsNotFull = {};
                for (var id in filters.hiding) {
                    var selectorFilter = filters.hiding[id];
                    if (selectorFilter._domains.full() === true) {
                        selectorsFull[id] = selectorFilter;
                    } else {
                        selectorsNotFull[id] = selectorFilter;
                    }
                }
                var selectorFilters = [];
                for (var id in selectorsNotFull) {
                    selectorFilters.push(selectorsNotFull[id]);
                }
                selectorFiltersAll = [];
                for (var id in selectorsFull) {
                    selectorFiltersAll.push(selectorsFull[id]);
                }
                var customRules = DeclarativeWebRequest.convertFilterLists(patternFilters, whitelistFilters, selectorFilters, selectorFiltersAll);
                log("customRules: ", customRules);
                //add the custom rules, with the filter list rules
                filterListRules.push.apply(filterListRules, customRules);
            }
            if (!filterListRules ||
                filterListRules.length === 0) {
                log("no rules to submit to safari");
                return;
            }
            if (filterListRules.length > 50000) {
                createRuleLimitExceededSafariNotification();
                log("exceed number of rules: " + filterListRules.length);
                filterListRules = filterListRules.slice(0, 49999);
            } else {
                //size is less then the limit, remove any previous error messages.
                sessionstorage_set("contentblockingerror");
                chrome.runtime.sendMessage({ command: "contentblockingmessageupdated" });
            }
            log("submitting rules to safari: # of rules: ", filterListRules.length);
            safari.extension.setContentBlocker(filterListRules);
        }

        // After 90 seconds, delete the cache. That way the cache is available when
        // rebuilding multiple times in a row (when multiple lists have to update at
        // the same time), but we save memory during all other times.
        window.setTimeout(function() {
            Filter._cache = {};
        }, 90000);
    }

    _splitByType(texts) {
        // Remove duplicates and empties.
        var unique = {};
        for (var i = 0; i < texts.length; i++) {
            unique[texts[i]] = 1;
        }
        delete unique[""];

        var filters = { hidingUnmerged: [], hiding: {}, exclude: {},
                       pattern: {}, whitelist: {} };
        for (var text in unique) {
            var filter = Filter.fromText(text);
            if (Filter.isSelectorExcludeFilter(text)) {
                setDefault(filters.exclude, filter.selector, []).push(filter);
            } else if (Filter.isSelectorFilter(text)) {
                filters.hidingUnmerged.push(filter);
            } else if (Filter.isWhitelistFilter(text)) {
                filters.whitelist[filter.id] = filter;
            } else {
                filters.pattern[filter.id] = filter;
            }
        }
        for (var i = 0; i < filters.hidingUnmerged.length; i++) {
            filter = filters.hidingUnmerged[i];
            var hider = SelectorFilter.merge(filter, filters.exclude[filter.selector]);
            filters.hiding[hider.id] = hider;
        }
        return filters;
    }

    // Change a property of a subscription or check if it has to be updated
    // Inputs: id: the id of the subscription to change
    //         subData: object containing all data that should be changed
    //         forceFetch: if the subscriptions have to be fetched again forced
    changeSubscription(id, subData, forceFetch) {

        var subscribeRequiredListToo = false;
        var listDidntExistBefore = false;

        // Check if the list has to be updated
        function out_of_date(subscription) {
            if (forceFetch) {
                return true;
            }
            // After a failure, wait at least a day to refetch (overridden below if
            // it's a new filter list, having no .text)
            var failed_at = subscription.last_update_failed_at || 0;
            if (Date.now() - failed_at < HOUR_IN_MS * 24) {
                return false;
            }
            // Don't let expiresAfterHours delay indefinitely (Issue 7443)
            var hardStop = subscription.expiresAfterHoursHard || 240;
            var smallerExpiry = Math.min(subscription.expiresAfterHours, hardStop);
            var millis = Date.now() - subscription.last_update;
            return (millis > HOUR_IN_MS * smallerExpiry);
        }

        //since the malware ID isn't really a filter list, we need to process it seperately
        if (id === "malware") {
            // Apply all changes from subData
            for (var property in subData) {
                if (subData[property] !== undefined) {
                    this._subscriptions[id][property] = subData[property];
                }
            }

            if (this._subscriptions[id].subscribed) {
                //if forceFetch, set the last update timestamp of the malware to zero, so it's updated now.
                if (forceFetch) {
                    this._subscriptions.malware.last_update = 0;
                }
                //load the malware domains
                this._loadMalwareDomains();
            } else {
                if (this.blocking) {
                    this.blocking.setMalwareDomains(null);
                }
                // If unsubscribed, remove properties
                delete this._subscriptions[id].text;
                delete this._subscriptions[id].rules;
                delete this._subscriptions[id].last_update;
                delete this._subscriptions[id].expiresAfterHours;
                delete this._subscriptions[id].last_update_failed_at;
                delete this._subscriptions[id].last_modified;
            }
            this._onSubscriptionChange(subData.subscribed === false);
            return;
        }

        // Working with an unknown list: create the list entry
        if (!this._subscriptions[id]) {
            id = this.customToDefaultId(id);
            if (/^url\:.*/.test(id)) {
                listDidntExistBefore = true;
                this._subscriptions[id] = {
                    user_submitted: true,
                    initialUrl: id.substr(4),
                    url: id.substr(4),
                    title: subData.title
                };
            }
            subscribeRequiredListToo = true;
        }

        // Subscribing to a well known list should also subscribe to a required list
        if (!this._subscriptions[id].subscribed && subData.subscribed) {
            subscribeRequiredListToo = true;
        }

        // Apply all changes from subData
        for (var property in subData) {
            if (subData[property] !== undefined) {
                this._subscriptions[id][property] = subData[property];
            }
        }

        // Check if the required list is a well known list, but only if it is changed
        if (subData.requiresList) {
            this._subscriptions[id].requiresList =
                this.customToDefaultId(this._subscriptions[id].requiresList);
        }

        if (forceFetch) {
            delete this._subscriptions[id].last_modified;
        }

        if (this._subscriptions[id].subscribed) {
            if ((!get_settings().safari_content_blocking && !this._subscriptions[id].text) ||
                (get_settings().safari_content_blocking && !this._subscriptions[id].rules) ||
                out_of_date(this._subscriptions[id])) {
                this.fetch_and_update(id, listDidntExistBefore);
            }
        } else {
            // If unsubscribed, remove some properties
            delete this._subscriptions[id].text;
            delete this._subscriptions[id].rules;
            delete this._subscriptions[id].last_update;
            delete this._subscriptions[id].expiresAfterHours;
            delete this._subscriptions[id].last_update_failed_at;
            delete this._subscriptions[id].last_modified;
            if (this._subscriptions[id].deleteMe) {
                delete this._subscriptions[id];
            }
        }

        // Notify of change.  If we subscribed, we rebuilt above; so we
        // only force a rebuild if we unsubscribed.
        this._onSubscriptionChange(subData.subscribed === false);

        // Subscribe to a required list if nessecary
        if (subscribeRequiredListToo && this._subscriptions[id] && this._subscriptions[id].requiresList) {
            this.changeSubscription(this._subscriptions[id].requiresList, { subscribed: true });
        }
    }

    // Fetch a filter list and parse it
    // id:        the id of the list
    // isNewList: true when the list is completely new and must succeed or
    //            otherwise it'll be deleted.
    fetch_and_update(id, isNewList) {
        var url = this._subscriptions[id].url;
        if (get_settings().safari_content_blocking) {
            if (!this._subscriptions[id].safariJSON_URL) {
                // Since the certain filter lists (AdBlock Custom) are embedded with the other filter lists
                // (when content blocking enabled)
                // we don't need to process it, just update the last_update timestamp.
                this._subscriptions[id].last_update = Date.now();
                chrome.runtime.sendMessage({ command: "filters_updated" });
                return;
            }
            url = this._subscriptions[id].safariJSON_URL;
        }
        var that = this;
        function onError() {
            that._subscriptions[id].last_update_failed_at = Date.now();
            that._onSubscriptionChange();
            if (isNewList) {
                // Delete the list. The user subscribed to an invalid list URL.
                // Delay it a bit, so subscribe.html can first finish it's async call to
                // see if the subscription succeeded or not. Otherwise it assumes it was
                // a well-known subscription and will report a succesfull fetch
                window.setTimeout(function() {
                    that.changeSubscription(id, {subscribed: false, deleteMe: true});
                }, 500);
            }
        }
        var ajaxRequest = {
            url: url,
            cache: false,
            headers: {
                "Accept": "text/plain",
                "X-Client-ID": "CatBlock",
                "If-Modified-Since": this._subscriptions[id].last_modified || undefined
            },
            success: function(text, status, xhr) {
                // In case the subscription disappeared while we were out
                if (!that._subscriptions[id] ||
                    !that._subscriptions[id].subscribed) {
                    return;
                }
                // Sometimes text is "". Happens sometimes.  Weird, I know.
                // Every legit list starts with a comment.
                if (status === "notmodified") {
                    log("List not modified " + url);
                    that._updateSubscriptionText(id, that._subscriptions[id].text);
                    that._onSubscriptionChange(true);
                } else if (text &&
                           (((typeof text === "string") &&
                             text.length !== 0 && Filter.isComment(text.trim())) ||
                            (typeof text === "object"))) {
                    log("Fetched " + url);
                    that._updateSubscriptionText(id, text, xhr);
                    that._onSubscriptionChange(true);
                } else {
                    log("Fetched, but invalid list " + url);
                    onError();
                }
            },
            error: function(xhr, textStatus, errorThrown) {
                if (that._subscriptions[id]) {
                    onError();
                }
                log("Error fetching " + url);
                log("textStatus " + textStatus);
                log("errorThrown " + errorThrown);
            }
        };
        $.ajax(ajaxRequest);
    }

    // Record that subscription_id is subscribed, was updated now, and has
    // the given text.  Requires that this._subscriptions[subscription_id] exists.
    // The xhr variable can be used to search the response headers
    _updateSubscriptionText(id, text, xhr) {
        this._subscriptions[id].last_update = Date.now();
        delete this._subscriptions[id].last_update_failed_at;
        //Safari 9 Content Blocking...
        if (get_settings().safari_content_blocking) {
            //if the |text| is JSON rules, save them, and return
            if (text && (typeof text === "object")) {
                // Record how many hours until we need to update the subscription text. Defaults to 120.
                this._subscriptions[id].expiresAfterHours = 120;
                this._subscriptions[id].expiresAfterHoursHard = this._subscriptions[id].expiresAfterHours * 2;
                var smear = Math.random() * 0.4 + 0.8;
                this._subscriptions[id].expiresAfterHours *= smear;
                this._subscriptions[id].rules = text;
                return;
            }
        }

        // In case the resource wasn't modified, there is no need to reparse this.
        // xhr isn't send in this case. Do reparse .text, in case we had some update
        // which modified the checks in filternormalizer.js.
        if (xhr) {
            // Store the last time a resource was modified on the server, so we won't re-
            // fetch if it wasn't modified. It is null if the server doesn't support this.
            this._subscriptions[id].last_modified = xhr.getResponseHeader("Last-Modified");
            // Record how many hours until we need to update the subscription text. This
            // can be specified in the file. Defaults to 120.
            this._subscriptions[id].expiresAfterHours = 120;
            var checkLines = text.split("\n", 15); //15 lines should be enough
            var expiresRegex = /(?:expires\:|expires\ after\ )\ *(\d+)\ ?(h?)/i;
            var redirectRegex = /(?:redirect\:|redirects\ to\ )\ *(https?\:\/\/\S+)/i;
            for (var i = 0; i < checkLines.length; i++) {
                if (!Filter.isComment(checkLines[i])) {
                    continue;
                }
                var match = checkLines[i].match(redirectRegex);
                if (match && match[1] !== this._subscriptions[id].url) {
                    this._subscriptions[id].url = match[1]; //assuming the URL is always correct
                    // Force an update.  Even if our refetch below fails we'll have to
                    // fetch the new URL in the future until it succeeds.
                    this._subscriptions[id].last_update = 0;
                }
                match = checkLines[i].match(expiresRegex);
                if (match && parseInt(match[1], 10)) {
                    var hours = parseInt(match[1], 10) * (match[2] === "h" ? 1 : 24);
                    this._subscriptions[id].expiresAfterHours = Math.min(hours, 21*24); // 3 week maximum
                }
            }
            // Smear expiry (Issue 7443)
            this._subscriptions[id].expiresAfterHoursHard = this._subscriptions[id].expiresAfterHours * 2;
            var smear = Math.random() * 0.4 + 0.8;
            this._subscriptions[id].expiresAfterHours *= smear;
        }

        this._subscriptions[id].text = FilterNormalizer.normalizeList(text);

        // The url changed. Simply refetch...
        if (this._subscriptions[id].last_update === 0) {
            this.changeSubscription(id, {}, true);
        }
    }

    // Checks if subscriptions have to be updated
    // Inputs: force? (boolean), true if every filter has to be updated
    checkFilterUpdates(force) {
        var key = "last_subscriptions_check";
        var now = Date.now();
        var delta = now - (storage_get(key) || now);
        var delta_hours = delta / HOUR_IN_MS;
        storage_set(key, now);
        if (delta_hours > 24) {
            // Extend expiration of subscribed lists (Issue 7443)
            for (var id in this._subscriptions) {
                if (this._subscriptions[id].subscribed) {
                    this._subscriptions[id].expiresAfterHours += delta_hours;
                }
            }
            this._onSubscriptionChange(); // Store the change
        }

        for (var id in this._subscriptions) {
            if (this._subscriptions[id].subscribed) {
                this.changeSubscription(id, {}, force);
            }
        }
    }

    // Checks if a custom id is of a known list
    // Inputs: id: the list id to compare
    // Returns the id that should be used
    customToDefaultId(id) {
        var urlOfCustomList = id.substr(4);
        for (var defaultList in this._official_options) {
            if (this._official_options[defaultList].url === urlOfCustomList) {
                return defaultList;
            }
        }
        return id;
    }

    // Retreive the list of malware domains from our site.
    // and set the response (list of domains) on the blocking
    // filter set for processing.
    // Retreive the list of malware domains from our site.
    // and set the response (list of domains) on the blocking
    // filter set for processing.
    _loadMalwareDomains() {

        function out_of_date(subscription) {
            // After a failure, wait at least a day to refetch (overridden below if
            // it has no .text)
            var failed_at = subscription.last_update_failed_at || 0;
            if (Date.now() - failed_at < HOUR_IN_MS * 24) {
                return false;
            }
            var hardStop = subscription.expiresAfterHoursHard || 240;
            var smallerExpiry = Math.min((subscription.expiresAfterHours || 24), hardStop);
            var millis = Date.now() - (subscription.last_update || 0);
            return (millis > HOUR_IN_MS * smallerExpiry);
        }

        if (!this._subscriptions.malware.text ||
            !this.getMalwareDomains() ||
            out_of_date(this._subscriptions.malware)) {
            var url = this._subscriptions.malware.url + "?_=" + new Date().getTime();
            // Fetch file with malware-known domains
            var xhr = new XMLHttpRequest();
            var that = this;
            xhr.onerror = function() {
                //if the request fail, retry the next time
                that._subscriptions.malware.last_update_failed_at = Date.now();
            };
            xhr.onload = function() {
                //make sure the blocking filter set exists (it may not in Safari 9)
                if (that.blocking) {
                    that.blocking.setMalwareDomains(JSON.parse(xhr.responseText));
                }
                //set the response text on the 'text' property so it's persisted to storage
                that._subscriptions.malware.text = JSON.parse(xhr.responseText);
                that._subscriptions.malware.last_update = Date.now();
                that._subscriptions.malware.last_modified = Date.now();
                delete that._subscriptions.malware.last_update_failed_at;
                //since the AdBlock Malware Domains.json file is only updated once a day
                //on the server, expiration is around 24 hours.
                that._subscriptions.malware.expiresAfterHours = 24;
                var smear = Math.random() * 0.4 + 0.8;
                that._subscriptions.malware.expiresAfterHours *= smear;
                chrome.runtime.sendMessage({ command: "filters_updated" });
                log("Fetched " + url);
            };
            xhr.open("GET", url);
            xhr.send();
        }
    }

    // Retreive the list of malware domains from our site.
    // and set the response (list of domains) on the blocking
    // filter set for processing.
    _initializeMalwareDomains() {
        if (this._subscriptions.malware.text) {
            this.blocking.setMalwareDomains(this._subscriptions.malware.text);
        } else {
            this._loadMalwareDomains();
        }
    }

    // Get the current list of malware domains
    // will return undefined, if the user is not subscribed to the Malware 'filter list'.
    getMalwareDomains() {
        // make sure the blocking filter set exists (it may not in Safari 9)
        if (this.blocking) {
            return this.blocking.getMalwareDomains();
        } else {
            return this._subscriptions.malware.text;
        }
    }

    // If the user wasn't subscribed to any lists, subscribe to
    // EasyList, AdBlock custom and (if any) a localized subscription
    // Inputs: none.
    // Returns an object containing the subscribed lists
    _load_default_subscriptions() {
        var result = {};
        // Returns the ID of the list appropriate for the user's locale, or ""
        function listIdForThisLocale() {
            var language = determineUserLanguage();
            switch (language) {
                case "ar": return "easylist_plus_arabic";
                case "bg": return "easylist_plus_bulgarian";
                case "cs": return "czech";
                case "cu": return "easylist_plus_bulgarian";
                case "da": return "danish";
                case "de": return "easylist_plus_german";
                case "el": return "easylist_plus_greek";
                case "es": return "easylist_plus_spanish";
                case "et": return "easylist_plus_estonian";
                case "fi": return "easylist_plus_finnish";
                case "fr": return "easylist_plus_french";
                case "he": return "israeli";
                case "hu": return "hungarian";
                case "is": return "icelandic";
                case "it": return "italian";
                case "id": return "easylist_plus_indonesian";
                case "ja": return "japanese";
                case "ko": return "easylist_plun_korean";
                case "lt": return "easylist_plus_lithuania";
                case "lv": return "latvian";
                case "nl": return "dutch";
                case "pl": return "easylist_plus_polish";
                case "ro": return "easylist_plus_romanian";
                case "ru": return "russian";
                case "sk": return "czech";
                case "sv": return "swedish";
                case "tr": return "turkish";
                case "uk": return "russian";
                case "zh": return "chinese";
                default: return "";
            }
        }
        // Update will be done immediately after this function returns
        result.adblock_custom = { subscribed: true };
        result.easylist = { subscribed: true };
        result.malware = { subscribed: true };
        var list_for_lang = listIdForThisLocale();
        if (list_for_lang) {
            result[list_for_lang] = { subscribed: true };
        }
        return result;
    }

    // Used to create the list of default subscriptions
    // Called when MyFilters is created.
    // Returns: that list
    _make_subscription_options() {
        // When modifying a list, IDs mustn't change!
        return {
            "adblock_custom": { // AdBlock custom filters
                url: "https://cdn.adblockcdn.com/filters/adblock_custom.txt"
            },
            "easylist": { // EasyList
                url: "https://easylist-downloads.adblockplus.org/easylist.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist.json"
            },
            "easylist_plus_bulgarian": { // Additional Bulgarian filters
                url: "http://stanev.org/abp/adblock_bg.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_bulgarian.json"
            },
            "dutch": { // Additional Dutch filters
                url: "https://easylist-downloads.adblockplus.org/easylistdutch.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/dutch.json"
            },
            "easylist_plus_finnish": { // Additional Finnish filters
                url: "http://adb.juvander.net/Finland_adb.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_finnish.json"
            },
            "easylist_plus_french": { // Additional French filters
                url: "https://easylist-downloads.adblockplus.org/liste_fr.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_french.json"
            },
            "easylist_plus_german": { // Additional German filters
                url: "https://easylist-downloads.adblockplus.org/easylistgermany.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_german.json"
            },
            "easylist_plus_greek": { // Additional Greek filters
                url: "https://www.void.gr/kargig/void-gr-filters.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_greek.json"
            },
            "easylist_plus_indonesian": { // Additional Indonesian filters
                url: "https://indonesianadblockrules.googlecode.com/hg/subscriptions/abpindo.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_indonesian.json"
            },
            "easylist_plus_polish": { // Additional Polish filters
                url: "https://www.certyficate.it/adblock/adblock.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_polish.json",
                requiresList: "easylist"
            },
            "easylist_plus_romanian": { // Additional Romanian filters
                url: "http://www.zoso.ro/pages/rolist.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_romanian.json"
            },
            "russian": { // Additional Russian filters
                url: "https://easylist-downloads.adblockplus.org/advblock.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/russian.json"
            },
            "chinese": { // Additional Chinese filters
                url: "https://easylist-downloads.adblockplus.org/easylistchina.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/chinese.json"
            },
            "czech": { // Additional Czech and Slovak filters
                url: "https://raw.github.com/tomasko126/easylistczechandslovak/master/filters.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/czech.json"
            },
            "danish": { // Danish filters
                url: "http://adblock.schack.dk/block.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/danish.json"
            },
            "hungarian": { // Hungarian filters
                url: "http://pete.teamlupus.hu/hufilter.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/hungarian.json"
            },
            "israeli": { // Israeli filters
                url: "https://easylist-downloads.adblockplus.org/israellist+easylist.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/israeli.json"
            },
            "italian": { // Italian filters
                url: "https://easylist-downloads.adblockplus.org/easylistitaly.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/italian.json",
                requiresList: "easylist"
            },
            "japanese": { // Japanese filters
                url: "https://raw.githubusercontent.com/k2jp/abp-japanese-filters/master/abpjf.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/japanese.json"
            },
            "easylist_plun_korean": {  // Korean filters
                url: "https://secure.fanboy.co.nz/fanboy-korean.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plun_korean.json"
            },
            "latvian": {  // Latvian filters
                url: "https://notabug.org/latvian-list/adblock-latvian/raw/master/lists/latvian-list.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/latvian.json",
                requiresList: "easylist"
            },
            "swedish": {  // Swedish filters
                url: "http://fanboy.co.nz/fanboy-swedish.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/swedish.json"
            },
            "turkish": {  // Turkish filters
                url: "http://fanboy.co.nz/fanboy-turkish.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/turkish.json"
            },
            "easyprivacy": { // EasyPrivacy
                url: "https://easylist-downloads.adblockplus.org/easyprivacy.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easyprivacy.json"
            },
            "antisocial": { // Antisocial
                url: "https://easylist-downloads.adblockplus.org/fanboy-social.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/antisocial.json"
            },
            "malware": { // Malware protection
                url: "https://cdn.adblockcdn.com/filters/domains.json"
            },
            "annoyances": { // Fanboy's Annoyances
                url: "https://easylist-downloads.adblockplus.org/fanboy-annoyance.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/annoyances.json"
            },
            "warning_removal": { // AdBlock warning removal
                url: "https://easylist-downloads.adblockplus.org/antiadblockfilters.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/warning_removal.json"
            },
            "easylist_plus_estonian": { // Estonian filters
                url: "http://gurud.ee/ab.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_estonian.json"
            },
            "easylist_plus_lithuania": { // Lithuania filters
                url: "http://margevicius.lt/easylistlithuania.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_lithuania.json"
            },
            "easylist_plus_arabic": { // Arabic filters
                url: "https://easylist-downloads.adblockplus.org/Liste_AR.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_arabic.json"
            },
            "icelandic": { // Icelandic filters
                url: "http://adblock.gardar.net/is.abp.txt",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/icelandic.json"
            },
            "easylist_plus_spanish": { // Spanish filters
                url: "https://easylist-downloads.adblockplus.org/easylistspanish.txt",
                requiresList: "easylist",
                safariJSON_URL: "https://cdn.adblockcdn.com/filters/spanish.json"
            }
        };
    }
}

/* subscription properties:
url (string): url of subscription
initialUrl (string): the hardcoded url. Same as .url except when redirected
user_submitted (bool): submitted by the user or not
requiresList (string): id of a list required for this list
subscribed (bool): if you are subscribed to the list or not
last_update (date): time of the last succesfull update
last_modified (string): time of the last change on the server
last_update_failed_at (date): if set, when the last update attempt failed
text (string): the filters of the subscription
expiresAfterHours (int): the time after which the subscription expires
expiresAfterHoursHard (int): we must redownload subscription after this delay
deleteMe (bool): if the subscription has to be deleted
*/
