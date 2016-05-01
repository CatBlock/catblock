// Send the file name and line number of any error message. This will help us
// to trace down any frequent errors we can't confirm ourselves.
window.addEventListener("error", function(e) {
    var str = "Error: " +
        (e.filename||"anywhere").replace(chrome.extension.getURL(""), "") +
        ":" + (e.lineno||"anywhere") +
        ":" + (e.colno||"anycol");
    if (e.error) {
        var stack = "-" + (e.error.message ||"") +
            "-" + (e.error.stack ||"");
        stack = stack.replace(/:/gi, ";").replace(/\n/gi, "");
        //only append the stack info if there isn't any URL info in the stack trace
        if (stack.indexOf("http") === -1) {
            str += stack;
        }
        //don't send large stack traces
        if (str.length > 512) {
            str = str.substr(0,511);
        }
    }
    sessionStorage.setItem("errorOccurred", true);
    storage_set("error", "Date added:" + new Date() + " " + str);
    log(str);
});

if (!SAFARI) {
    // Records how many ads have been blocked by AdBlock.  This is used
    // by the AdBlock app in the Chrome Web Store to display statistics
    // to the user.
    var blockCounts = (function() {
        var key = "blockage_stats";
        var data = storage_get(key);
        if (!data)
            data = {};
        if (data.start === undefined)
            data.start = Date.now();
        if (data.total === undefined)
            data.total = 0;
        data.version = 1;
        storage_set(key, data);

        return {
            recordOneAdBlocked: function(tabId) {
                var data = storage_get(key);
                data.total += 1;
                storage_set(key, data);

                //code for incrementing ad blocks
                currentTab = frameData.get(tabId);
                if(currentTab){
                    currentTab.blockCount++;
                }
            },
            get: function() {
                return storage_get(key);
            },
            getTotalAdsBlocked: function(tabId){
                if(tabId){
                    currentTab = frameData.get(tabId);
                    return currentTab ? currentTab.blockCount : 0;
                }
                return this.get().total;
            }
        };
    })();

}

// OPTIONAL SETTINGS

function Settings() {
    var defaults = {
        catblock: true,
        debug_logging: false,
        youtube_channel_whitelist: false,
        whitelist_hulu_ads: false, // Issue 7178
        show_context_menu_items: true,
        show_advanced_options: false,
        display_stats: true,
        display_menu_stats: true,
        show_block_counts_help_link: true
    };
    var settings = storage_get('settings') || {};
    this._data = $.extend(defaults, settings);

};
Settings.prototype = {
    set: function(name, is_enabled) {
        this._data[name] = is_enabled;
        // Don't store defaults that the user hasn't modified
        var stored_data = storage_get("settings") || {};
        stored_data[name] = is_enabled;
        storage_set('settings', stored_data);
    },
    get_all: function() {
        return this._data;
    }
};
_settings = new Settings();

// Open a new tab with a given URL.
// Inputs:
//   url: string - url for the tab
//   nearActive: bool - open the tab near currently active (instead of at the end). optional, defaults to false
//   safariWindow (Safari only): window object - window where the tab will be created. optional, defaults
//     to active window. Because Safari supports clickthrough on extension elements, Safari code will almost
//    always need to pass this argument. Chrome doesn't support it, so leave this argument empty in Chrome code.
function openTab(url, nearActive, safariWindow) {
    if (!SAFARI) {
        chrome.windows.getCurrent(function(current) {
            // Normal window - open tab in it
            if (!current.incognito) {
                if (!nearActive) {
                    chrome.tabs.create({url: url});
                } else {
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        chrome.tabs.create({ url: url, index: (tabs[0] ? tabs[0].index + 1 : undefined)});
                    });
                }
            } else {
                // Get all windows
                chrome.windows.getAll(function(window) {
                    var windowId = null;
                    for (var i=0; i<window.length; i++) {
                        // We have found a normal (non-incognito) window
                        if (!window[i].incognito && window[i].type === "normal") {
                            // If more normal windows were found,
                            // overwrite windowId, so we get the most recent
                            // opened normal window
                            windowId = window[i].id;
                        }
                    }
                    // Create a new tab in found normal window
                    if (windowId) {
                        if (!nearActive) {
                            chrome.tabs.create({windowId: windowId, url: url, active: true});
                        } else {
                            chrome.tabs.query({active: true, windowId: windowId}, function(tabs) {
                                chrome.tabs.create({windowId: windowId, url: url,
                                                    index: (tabs[0] ? tabs[0].index + 1 : undefined), active: true});
                                chrome.windows.update(windowId, {focused: true});
                            });
                        }
                        chrome.windows.update(windowId, {focused: true});
                    } else {
                        // Normal window is not currently opened,
                        // so create a new one
                        chrome.tabs.create({url: url});
                    }
                });
            }
        });
    } else {
        safariWindow = safariWindow || safari.application.activeBrowserWindow;
        var index = undefined;
        if (nearActive && safariWindow && safariWindow.activeTab) {
            for (var i = 0; i < safariWindow.tabs.length; i++) {
                if (safariWindow.tabs[i] === safariWindow.activeTab) {
                    index = i + 1;
                    break;
                }
            }
        }
        var tab;
        if (safariWindow) {
            tab = safariWindow.openTab("foreground", index); // index may be undefined
            if (!safariWindow.visible) {
                safariWindow.activate();
            }
        } else {
            tab = safari.application.openBrowserWindow().tabs[0];
        }
        var relative = (!/:\/\//.test(url)); // fix relative URLs
        tab.url = (relative ? chrome.extension.getURL(url) : url);
    }
};

// Reload already opened tab
// Input:
//   tabId: integer - id of the tab which should be reloaded
reloadTab = function(tabId) {
    var listener = function(tabId, changeInfo, tab) {
        if (changeInfo.status === "complete" &&
            tab.status === "complete") {
            setTimeout(function() {
                chrome.runtime.sendMessage({command: "reloadcomplete"});
                chrome.tabs.onUpdated.removeListener(listener);
            }, 2000);
        }
    }
    chrome.tabs.reload(tabId, { bypassCache: true }, function() {
        chrome.tabs.onUpdated.addListener(listener);
    });
}

// Implement blocking via the Chrome webRequest API.
// Stores url, whitelisting, and blocking info for a tabid+frameid
// TODO: can we avoid making this a global?
if (!SAFARI) {
    frameData = {
        // Returns the data object for the frame with ID frameId on the tab with
        // ID tabId. If frameId is not specified, it'll return the data for all
        // frames on the tab with ID tabId. Returns undefined if tabId and frameId
        // are not being tracked.
        get: function(tabId, frameId) {
            if (frameId !== undefined)
                return (frameData[tabId] || {})[frameId];
            return frameData[tabId];
        },

        // Record that |tabId|, |frameId| points to |url|.
        record: function(tabId, frameId, url) {
            var fd = frameData;
            if (!fd[tabId]) fd[tabId] = {};
            fd[tabId][frameId] = {
                url: url,
                // Cache these as they'll be needed once per request
                domain: parseUri(url).hostname,
                resources: {}
            };
            fd[tabId][frameId].whitelisted = page_is_whitelisted(url);
        },

        // Watch for requests for new tabs and frames, and track their URLs.
        // Inputs: details: object from onBeforeRequest callback
        // Returns false if this request's tab+frame are not trackable.
        track: function(details) {
            var fd = frameData, tabId = details.tabId;

            // A hosted app's background page
            if (tabId === -1) {
                return false;
            }

            if (details.type === 'main_frame') { // New tab
                delete fd[tabId];
                fd.record(tabId, 0, details.url);
                fd[tabId].blockCount = 0;
                log("\n-------", fd.get(tabId, 0).domain, ": loaded in tab", tabId, "--------\n\n");
                return true;
            }

            // Request from a tab opened before AdBlock started, or from a
            // chrome:// tab containing an http:// iframe
            if (!fd[tabId]) {
                log("[DEBUG]", "Ignoring unknown tab:", tabId, details.frameId, details.url);
                return false;
            }

            // Some times e.g. Youtube create empty iframes via JavaScript and
            // inject code into them.  So requests appear from unknown frames.
            // Treat these frames as having the same URL as the tab.
            var potentialEmptyFrameId = (details.type === 'sub_frame' ? details.parentFrameId: details.frameId);
            if (undefined === fd.get(tabId, potentialEmptyFrameId)) {
                fd.record(tabId, potentialEmptyFrameId, fd.get(tabId, 0).url);
                log("[DEBUG]", "Null frame", tabId, potentialEmptyFrameId, "found; giving it the tab's URL.");
            }

            if (details.type === 'sub_frame') { // New frame
                fd.record(tabId, details.frameId, details.url);
                log("[DEBUG]", "=========== Tracking frame", tabId, details.parentFrameId, details.frameId, details.url);
            }

            return true;
        },

        // Save a resource for the resource blocker.
        storeResource: function(tabId, frameId, url, elType, frameDomain) {
            if (!get_settings().show_advanced_options)
                return;
            var data = frameData.get(tabId, frameId);
            if (data !== undefined) {
                data.resources[elType + ":|:" + url + ":|:" + frameDomain] = null;
            }
        },

        removeTabId: function(tabId) {
            delete frameData[tabId];
        }
    };

    var normalizeRequestType = function(details) {
        // normalize type, because of issue with Chrome 38+
        var type = details.type;
        if (type !== 'other') {
            return type;
        }
        var url = parseUri(details.url);
        if (url && url.pathname) {
            var pos = url.pathname.lastIndexOf('.');
            if (pos > -1) {
                var ext = url.pathname.slice(pos) + '.';
                // Still need this because often behind-the-scene requests are wrongly
                // categorized as 'other'
                if ('.ico.png.gif.jpg.jpeg.webp.'.indexOf(ext) !== -1) {
                    return 'image';
                }
            }
        }
        // see crbug.com/410382
        return 'object';
    };

    // When a request starts, perhaps block it.
    function onBeforeRequestHandler(details) {
        if (adblock_is_paused())
            return { cancel: false };

        // Convert punycode domain to Unicode - GH #472
        details.url = getUnicodeUrl(details.url);

        if (!frameData.track(details))
            return { cancel: false };

        var tabId = details.tabId;
        var reqType = normalizeRequestType({url: details.url, type: details.type});

        var top_frame = frameData.get(tabId, 0);
        var sub_frame = (details.frameId !== 0 ? frameData.get(tabId, details.frameId) : null);

        // If top frame is whitelisted, don't process anything
        if (top_frame.whitelisted) {
            log("[DEBUG]", "Ignoring whitelisted tab", tabId, details.url.substring(0, 100));
            return { cancel: false };
            // If request comes from whitelisted sub_frame and
            // top frame is not whitelisted, don't process the request
        } else if (sub_frame && sub_frame.whitelisted) {
            log("[DEBUG]", "Ignoring whitelisted frame", tabId, details.url.substring(0, 100));
            return { cancel: false };
        }

        // For most requests, Chrome and we agree on who sent the request: the frame.
        // But for iframe loads, we consider the request to be sent by the outer
        // frame, while Chrome claims it's sent by the new iframe.  Adjust accordingly.
        var requestingFrameId = (reqType === 'sub_frame' ? details.parentFrameId : details.frameId);

        var elType = ElementTypes.fromOnBeforeRequestType(reqType);

        // May the URL be loaded by the requesting frame?
        var frameDomain = frameData.get(tabId, requestingFrameId).domain;
        var blocked = _myfilters.blocking.matches(details.url, elType, frameDomain);

        frameData.storeResource(tabId, requestingFrameId, details.url, elType, frameDomain);

        // Issue 7178
        if (blocked && frameDomain === "www.hulu.com") {
            if (frameData.get(tabId, 0).domain !== "www.hulu.com"
                && /ads\.hulu\.com/.test(details.url)) // good enough
                blocked = false;
        }

        var canPurge = (elType & (ElementTypes.image | ElementTypes.subdocument | ElementTypes.object));
        if (canPurge && blocked) {
            // frameUrl is used by the recipient to determine whether they're the frame who should
            // receive this or not.  Because the #anchor of a page can change without navigating
            // the frame, ignore the anchor when matching.
            var frameUrl = frameData.get(tabId, requestingFrameId).url.replace(/#.*$/, "");
            var data = { command: "purge-elements", tabId: tabId, frameUrl: frameUrl, url: details.url, elType: elType };
            chrome.tabs.sendRequest(tabId, data);
        }
        if (blocked) {
            blockCounts.recordOneAdBlocked(tabId);
            updateBadge(tabId);
        }
        log("[DEBUG]", "Block result", blocked, reqType, frameDomain, details.url.substring(0, 100));
        if (blocked && elType === ElementTypes.subdocument) {
            return { redirectUrl: "about:blank" };
        }
        return { cancel: blocked };
    }

    // Popup blocking
    function onCreatedNavigationTargetHandler(details) {
        if (adblock_is_paused())
            return;
        var opener = frameData.get(details.sourceTabId, details.sourceFrameId);
        if (opener === undefined)
            return;
        if (frameData.get(details.sourceTabId, 0).whitelisted)
            return;
        // Change to opener's url in so that it would still be tested against the
        // blocking filter's regex rule. Github issue # 69
        if (details.url === "about:blank")
            details.url = opener.url;
        var url = getUnicodeUrl(details.url);
        var match = _myfilters.blocking.matches(url, ElementTypes.popup, opener.domain);
        if (match) {
            chrome.tabs.remove(details.tabId);
            blockCounts.recordOneAdBlocked(details.sourceTabId);
            updateBadge(details.sourceTabId);
        }
        frameData.storeResource(details.sourceTabId, details.sourceFrameId, url, ElementTypes.popup, opener.domain);
    };

    // If tabId has been replaced by Chrome, delete it's data
    if (chrome.webNavigation.onTabReplaced) {
        chrome.webNavigation.onTabReplaced.addListener(function(details) {
            frameData.removeTabId(details.replacedTabId);
        });
    }

    if (chrome.webNavigation.onHistoryStateUpdated) {
        chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
            if (details &&
                details.hasOwnProperty("frameId") &&
                details.hasOwnProperty("tabId") &&
                details.hasOwnProperty("url") &&
                details.hasOwnProperty("transitionType") &&
                details.transitionType === "link") {
                // On some single page sites that update the URL using the History API pushState(),
                // but they don't actually load a new page, we need to get notified when this happens
                // and track these updates in the frameData object.
                var tabData = frameData.get(details.tabId, details.frameId);
                if (tabData &&
                    tabData.url !== details.url) {
                    details.type = 'main_frame';
                    details.url = getUnicodeUrl(details.url);
                    frameData.track(details);
                }
            }
        });
    }
}

debug_report_elemhide = function(selector, matches, sender) {
    if (!window.frameData) {
        return;
    }
    var frameDomain = parseUri(sender.url || sender.tab.url).hostname;
    frameData.storeResource(sender.tab.id, sender.frameId || 0, selector, "selector", frameDomain);

    var data = frameData.get(sender.tab.id, sender.frameId || 0);
    if (data) {
        log(data.domain, ": hiding rule", selector, "matched:\n", matches);
        if (!SAFARI) {
            blockCounts.recordOneAdBlocked(sender.tab.id);
            updateBadge(sender.tab.id);
        }
    }
}

// UNWHITELISTING

// Look for a custom filter that would whitelist options.url,
// and if any exist, remove the first one.
// Inputs: url:string - a URL that may be whitelisted by a custom filter
// Returns: true if a filter was found and removed; false otherwise.
try_to_unwhitelist = function(url) {
    url = url.replace(/#.*$/, ''); // Whitelist ignores anchors
    var custom_filters = get_custom_filters_text().split('\n');
    for (var i = 0; i < custom_filters.length; i++) {
        var text = custom_filters[i];
        var whitelist = text.search(/@@\*\$document,domain=\~/);
        // Blacklist site, which is whitelisted by global @@*&document,domain=~ filter
        if (whitelist > -1) {
            // Remove protocols
            url = url.replace(/((http|https):\/\/)?(www.)?/, "").split(/[/?#]/)[0];

            text = text + "|~" + url;
            custom_filters.splice(i, 1); // Remove the old filter text
            custom_filters.push(text); // add the new filter text to original array
            var new_text = custom_filters.join('\n');
            set_custom_filters_text(new_text);
            return true;
        } else {
            if (!Filter.isWhitelistFilter(text))
                continue;
            try {
                var filter = PatternFilter.fromText(text);
            } catch (ex) {
                continue;
            }
            if (!filter.matches(url, ElementTypes.document, false))
                continue;

            custom_filters.splice(i, 1); // Remove this whitelist filter text
            var new_text = custom_filters.join('\n');
            set_custom_filters_text(new_text);
            return true;
        }
    }
    return false;
}

// Called when Chrome blocking needs to clear the in-memory cache.
// No-op for Safari.
handlerBehaviorChanged = function() {
    if (SAFARI)
        return;
    try {
        chrome.webRequest.handlerBehaviorChanged();
    } catch (ex) {
    }
}

// CUSTOM FILTERS

// Get the custom filters text as a \n-separated text string.
get_custom_filters_text = function() {
    return storage_get('custom_filters') || '';
}

// Set the custom filters to the given \n-separated text string, and
// rebuild the filterset.
// Inputs: filters:string the new filters.
set_custom_filters_text = function(filters) {
    storage_set('custom_filters', filters);
    chrome.runtime.sendMessage({command: "filters_updated"});
    _myfilters.rebuild();
}

// Get the user enterred exclude filters text as a \n-separated text string.
get_exclude_filters_text = function() {
    return storage_get('exclude_filters') || '';
}
// Set the exclude filters to the given \n-separated text string, and
// rebuild the filterset.
// Inputs: filters:string the new filters.
set_exclude_filters = function(filters) {
    filters = filters.trim();
    filters = filters.replace(/\n\n/g, '\n');
    storage_set('exclude_filters', filters);
    FilterNormalizer.setExcludeFilters(filters);
    update_subscriptions_now();
}
// Add / concatenate the exclude filter to the existing excluded filters, and
// rebuild the filterset.
// Inputs: filter:string the new filter.
add_exclude_filter = function(filter) {
    var currentExcludedFilters = get_exclude_filters_text();
    if (currentExcludedFilters) {
        set_exclude_filters(currentExcludedFilters + "\n" + filter);
    } else {
        set_exclude_filters(filter);
    }
}

// Removes a custom filter entry.
// Inputs: host:domain of the custom filters to be reset.
remove_custom_filter = function(host) {
    var text = get_custom_filters_text();
    var custom_filters_arr = text ? text.split("\n"):[];
    var new_custom_filters_arr = [];
    var identifier = host;

    for(var i = 0; i < custom_filters_arr.length; i++) {
        var entry = custom_filters_arr[i];
        //Make sure that the identifier is at the start of the entry
        if(entry.indexOf(identifier) === 0) { continue; }
        new_custom_filters_arr.push(entry);
    }

    text = new_custom_filters_arr.join("\n");
    set_custom_filters_text(text.trim());
}

// count_cache singleton.
var count_cache = (function(count_map) {
    var cache = count_map;
    // Update custom filter count stored in localStorage
    var _updateCustomFilterCount = function() {
        storage_set("custom_filter_count", cache);
    };

    return {
        // Update custom filter count cache and value stored in localStorage.
        // Inputs: new_count_map:count map - count map to replace existing count cache
        updateCustomFilterCountMap: function(new_count_map) {
            cache = new_count_map || cache;
            _updateCustomFilterCount();
        },
        // Remove custom filter count for host
        // Inputs: host:string - url of the host
        removeCustomFilterCount: function(host) {
            if(host && cache[host]) {
                delete cache[host];
                _updateCustomFilterCount();
            }
        },
        // Get current custom filter count for a particular domain
        // Inputs: host:string - url of the host
        getCustomFilterCount: function(host) {
            return cache[host] || 0;
        },
        // Add 1 to custom filter count for the filters domain.
        // Inputs: filter:string - line of text to be added to custom filters.
        addCustomFilterCount: function(filter) {
            var host = filter.split("##")[0];
            cache[host] = this.getCustomFilterCount(host) + 1;
            _updateCustomFilterCount();
        }
    }
})(storage_get("custom_filter_count") || {});

// Entry point for customize.js, used to update custom filter count cache.
updateCustomFilterCountMap = function(new_count_map) {
    count_cache.updateCustomFilterCountMap(new_count_map);
}

remove_custom_filter_for_host = function(host) {
    if (count_cache.getCustomFilterCount(host)) {
        remove_custom_filter(host);
        count_cache.removeCustomFilterCount(host);
    }
}

confirm_removal_of_custom_filters_on_host = function(host, activeTab) {
    var custom_filter_count = count_cache.getCustomFilterCount(host);
    var confirmation_text   = translate("confirm_undo_custom_filters", [custom_filter_count, host]);
    if (!confirm(confirmation_text)) { return; }
    remove_custom_filter_for_host(host);
    if (!SAFARI) {
        chrome.tabs.reload();
    } else {
        activeTab.url = activeTab.url;
    }
};

get_settings = function() {
    return _settings.get_all();
}

set_setting = function(name, is_enabled) {
    _settings.set(name, is_enabled);

    if (name === "debug_logging")
        logging(is_enabled);
}

disable_setting = function(name) {
    _settings.set(name, false);
}

// MYFILTERS PASSTHROUGHS

// Rebuild the filterset based on the current settings and subscriptions.
update_filters = function() {
    _myfilters.rebuild();
}

// Fetch the latest version of all subscribed lists now.
update_subscriptions_now = function() {
    _myfilters.checkFilterUpdates(true);
}

// Returns map from id to subscription object.  See filters.js for
// description of subscription object.
get_subscriptions_minus_text = function() {
    var result = {};
    for (var id in _myfilters._subscriptions) {
        result[id] = {};
        for (var attr in _myfilters._subscriptions[id]) {
            if ((attr === "text") || (attr === "rules")) continue;
            result[id][attr] = _myfilters._subscriptions[id][attr];
        }
    }
    return result;
}

// Get subscribed filter lists
get_subscribed_filter_lists = function() {
    var subs = get_subscriptions_minus_text();
    var subscribed_filter_names = [];
    for (var id in subs) {
        if (subs[id].subscribed)
            subscribed_filter_names.push(id);
    }
    return subscribed_filter_names;
}

// Subscribes to a filter subscription.
// Inputs: id: id to which to subscribe.  Either a well-known
//             id, or "url:xyz" pointing to a user-specified list.
//         requires: the id of a list if it is a supplementary list,
//                   or null if nothing required
// Returns: null, upon completion
subscribe = function(options) {
    _myfilters.changeSubscription(options.id, {
        subscribed: true,
        requiresList: options.requires,
        title: options.title
    });
}

// Unsubscribes from a filter subscription.
// Inputs: id: id from which to unsubscribe.
//         del: (bool) if the filter should be removed or not
// Returns: null, upon completion.
unsubscribe = function(options) {
    _myfilters.changeSubscription(options.id, {
        subscribed: false,
        deleteMe: (options.del ? true : undefined)
    });
}

// Get the current (loaded) malware domains
// Returns: an object with all of the malware domains
// will return undefined, if the user is not subscribed to the Malware 'filter list'.
getMalwareDomains = function() {
    return _myfilters.getMalwareDomains();
}

// Returns true if the url cannot be blocked
page_is_unblockable = function(url) {
    if (!url) { // Safari empty/bookmarks/top sites page
        return true;
    } else {
        var scheme = parseUri(url).protocol;
        return (scheme !== 'http:' && scheme !== 'https:' && scheme !== 'feed:');
    }
}

// Get or set if AdBlock is paused
// Inputs: newValue (optional boolean): if true, AdBlock will be paused, if
//                  false, AdBlock will not be paused.
// Returns: undefined if newValue was specified, otherwise it returns true
//          if paused, false otherwise.
adblock_is_paused = function(newValue) {
    if (newValue === undefined) {
        return sessionStorage.getItem('adblock_is_paused') === "true";
    }
    sessionStorage.setItem('adblock_is_paused', newValue);
    // To prevent certain web site issues that occur with the "beforeload" event listener
    // remove the Safari specific "beforeload" script when AdBlock is paused, and
    // add it back when AdBlock is un-paused
    if (SAFARI && !get_settings().safari_content_blocking) {
        if (newValue) {
            safari.extension.removeContentScript(safari.extension.baseURI + "adblock_safari_beforeload.js");
        } else {
            safari.extension.addContentScriptFromURL(safari.extension.baseURI + "adblock_safari_beforeload.js", [], [], false);
        }
    }
}

// Get if AdBlock is paused
// called from content scripts
// Returns: true if paused, false otherwise.
is_adblock_paused = function() {
    return adblock_is_paused();
}

// INFO ABOUT CURRENT PAGE

// Get interesting information about the current tab.
// Inputs:
//   callback: function(info).
//   info object passed to callback: {
//     tab: Tab object
//     whitelisted: bool - whether the current tab's URL is whitelisted.
//     disabled_site: bool - true if the url is e.g. about:blank or the
//                           Extension Gallery, where extensions don't run.
//     total_blocked: int - # of ads blocked since install
//     tab_blocked: int - # of ads blocked on this tab
//     display_stats: bool - whether block counts are displayed on button
//     display_menu_stats: bool - whether block counts are displayed on the popup menu
//   }
// Returns: null (asynchronous)
getCurrentTabInfo = function(callback, secondTime) {
    if (!SAFARI) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length === 0)
                return; // For example: only the background devtools or a popup are opened

            var tab = tabs[0];

            if (tab && !tab.url) {
                // Issue 6877: tab URL is not set directly after you opened a window
                // using window.open()
                if (!secondTime)
                    window.setTimeout(function() {
                        getCurrentTabInfo(callback, true);
                    }, 250);
                return;
            }

            // GH #472
            tab.unicodeUrl = getUnicodeUrl(tab.url);

            var disabled_site = page_is_unblockable(tab.unicodeUrl);
            var total_blocked = blockCounts.getTotalAdsBlocked();
            var tab_blocked = blockCounts.getTotalAdsBlocked(tab.id);
            var display_stats = get_settings().display_stats;
            var display_menu_stats = get_settings().display_menu_stats;

            var result = {
                tab: tab,
                disabled_site: disabled_site,
                total_blocked: total_blocked,
                tab_blocked: tab_blocked,
                display_stats: display_stats,
                display_menu_stats: display_menu_stats
            };

            if (!disabled_site)
                result.whitelisted = page_is_whitelisted(tab.unicodeUrl);

            callback(result);
        });
    } else {
        var browserWindow = safari.application.activeBrowserWindow;
        var tab = browserWindow.activeTab;
        tab.unicodeUrl = getUnicodeUrl(tab.url); // GH #472
        var disabled_site = page_is_unblockable(tab.unicodeUrl);

        var result = {
            tab: tab,
            disabled_site: disabled_site,
        };

        if (!disabled_site)
            result.whitelisted = page_is_whitelisted(tab.unicodeUrl);

        callback(result);
    }
}

// Returns true if anything in whitelist matches the_domain.
//   url: the url of the page
//   type: one out of ElementTypes, default ElementTypes.document,
//         to check what the page is whitelisted for: hiding rules or everything
page_is_whitelisted = function(url, type) {
    if (!url) { // Safari empty/bookmarks/top sites page
        return true;
    }
    // In Safari with content blocking enabled,
    // whitelisting of domains is not currently supported.
    if (get_settings().safari_content_blocking) {
        return false;
    }
    url = getUnicodeUrl(url);
    url = url.replace(/\#.*$/, ''); // Remove anchors
    if (!type)
        type = ElementTypes.document;
    var whitelist = _myfilters.blocking.whitelist;
    return whitelist.matches(url, type, parseUri(url).hostname, false);
}

if (!SAFARI) {
    var setBrowserActions = function(options) {
        var iconCallback = function() {
            if (chrome.runtime.lastError) {
                return;
            }
            chrome.browserAction.setBadgeText({text: options.badge_text, tabId: options.tabId});
            chrome.browserAction.setBadgeBackgroundColor({ color: options.color });
        };
        chrome.browserAction.getBadgeText({}, function(result) {
                if (result === "New!") {
                    return;
                } else {
                    chrome.browserAction.setIcon({ tabId: options.tabId, path: options.iconPaths }, iconCallback);
                }
        });
    }

    updateBadge = function(tabId) {
        var display = get_settings().display_stats;
        var badge_text = "";
        var main_frame = frameData.get(tabId, 0);
        // main_frame is undefined if the tab is a new one, so no use updating badge.
        if (!main_frame) return;

        var isBlockable = !page_is_unblockable(main_frame.url) && !page_is_whitelisted(main_frame.url) && !/chrome\/newtab/.test(main_frame.url);

        if (display && (main_frame && isBlockable) && !adblock_is_paused()) {
            var browsersBadgeOptions = {};
            browsersBadgeOptions.tabId = tabId;
            browsersBadgeOptions.color = "#555";
            var badge_text = blockCounts.getTotalAdsBlocked(tabId).toString();
            if (badge_text === "0")
                badge_text = ""; // Only show the user when we've done something useful
            browsersBadgeOptions.badge_text = badge_text;
            browsersBadgeOptions.iconPaths = {'19': 'img/icon19.png', '38': 'img/icon38.png'};
            //see for more details - https://code.google.com/p/chromium/issues/detail?id=410868#c8
            setBrowserActions(browsersBadgeOptions);
        }
    };

    // Set the button image and context menus according to the URL
    // of the current tab.
    updateButtonUIAndContextMenus = function() {
        function setContextMenus(info) {
            chrome.contextMenus.removeAll();
            if (!get_settings().show_context_menu_items)
                return;

            if (adblock_is_paused() || info.whitelisted || info.disabled_site)
                return;

            function addMenu(title, callback) {
                chrome.contextMenus.create({
                    title: title,
                    contexts: ["all"],
                    onclick: function(clickdata, tab) { callback(tab, clickdata); }
                });
            }

            addMenu(translate("block_this_ad"), function(tab, clickdata) {
                emit_page_broadcast(
                    {fn:'top_open_blacklist_ui', options:{info: clickdata}},
                    {tab: tab}
                );
            });

            addMenu(translate("block_an_ad_on_this_page"), function(tab) {
                emit_page_broadcast(
                    {fn:'top_open_blacklist_ui', options:{nothing_clicked: true}},
                    {tab: tab}
                );
            });

            var host                = getUnicodeDomain(parseUri(info.tab.unicodeUrl).host);
            var custom_filter_count = count_cache.getCustomFilterCount(host);
            if (custom_filter_count) {
                addMenu(translate("undo_last_block"), function(tab) {
                    confirm_removal_of_custom_filters_on_host(host);
                });
            }
        }

        function setBrowserButton(info) {
            var browsersBadgeOptions = {};
            browsersBadgeOptions.tabId = info.tab.id;
            browsersBadgeOptions.color = "#555";
            browsersBadgeOptions.badge_text = "";
            if (adblock_is_paused()) {
                browsersBadgeOptions.iconPaths = {'19': "img/icon19-grayscale.png", '38': "img/icon38-grayscale.png"};
                setBrowserActions(browsersBadgeOptions);
            } else if (info.disabled_site &&
                       !/^chrome-extension:.*pages\/install\//.test(info.tab.unicodeUrl)) {
                // Show non-disabled icon on the installation-success page so it
                // users see how it will normally look. All other disabled pages
                // will have the gray one
                browsersBadgeOptions.iconPaths = {'19': "img/icon19-grayscale.png", '38': "img/icon38-grayscale.png"};
                setBrowserActions(browsersBadgeOptions);
            } else if (info.whitelisted) {
                browsersBadgeOptions.iconPaths = {'19': "img/icon19-whitelisted.png", '38': "img/icon38-whitelisted.png"};
                setBrowserActions(browsersBadgeOptions);
            } else {
                updateBadge(info.tab.id);
            }
        }

        getCurrentTabInfo(function(info) {
            setContextMenus(info);
            setBrowserButton(info);
        });
    }
}

// These functions are usually only called by content scripts.

// Add a new custom filter entry.
// Inputs: filter:string line of text to add to custom filters.
// Returns: null if succesfull, otherwise an exception
add_custom_filter = function(filter) {
    var custom_filters = get_custom_filters_text();
    try {
        if (FilterNormalizer.normalizeLine(filter)) {
            if (Filter.isSelectorFilter(filter)) {
                count_cache.addCustomFilterCount(filter);
                if (!SAFARI)
                    updateButtonUIAndContextMenus();
            }
            custom_filters = custom_filters + '\n' + filter;
            set_custom_filters_text(custom_filters);
            return null;
        }
        return "This filter is unsupported";
    } catch(ex) {
        //convert to a string so that Safari can pass
        //it back to content scripts
        return ex.toString();
    }
};

// Return the contents of a local file.
// Inputs: file:string - the file relative address, eg "js/foo.js".
// Returns: the content of the file.
readfile = function(file) {
    // A bug in jquery prevents local files from being read, so use XHR.
    var xhr = new XMLHttpRequest();
    xhr.open("GET", chrome.extension.getURL(file), false);
    xhr.send();
    return xhr.responseText;
};

// Creates a custom filter entry that whitelists a given page
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
create_page_whitelist_filter = function(url) {
    var url = url.replace(/#.*$/, '');  // Remove anchors
    var parts = url.match(/^([^\?]+)(\??)/); // Detect querystring
    var has_querystring = parts[2];
    var filter = '@@|' + parts[1] + (has_querystring ? '?' : '|') + '$document';
    return add_custom_filter(filter);
}

// Creates a custom filter entry that whitelists a YouTube channel
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
create_whitelist_filter_for_youtube_channel = function(url) {
    if (/ab_channel=/.test(url)) {
        var yt_channel = url.match(/ab_channel=([^]*)/)[1];
    } else {
        var yt_channel = url.split('/').pop();
    }
    if (yt_channel) {
        var filter = '@@|https://www.youtube.com/*' + yt_channel + '|$document';
        return add_custom_filter(filter);
    }
}

// Inputs: options object containing:
//           domain:string the domain of the calling frame.
get_content_script_data = function(options, sender) {
    var settings = get_settings();
    var runnable = !adblock_is_paused() && !page_is_unblockable(sender.url);
    var running_top = runnable && !page_is_whitelisted(sender.tab.url);
    var running = runnable && !page_is_whitelisted(sender.url);
    var hiding = running && !page_is_whitelisted(sender.url, ElementTypes.elemhide);

    // Don't run in frame, when top frame is whitelisted
    // TODO: Edge doesn't contain sender.tab.url property
    if (!running_top && running && !EDGE) {
        running = false;
        hiding = false;
    }

    var result = {
        settings: settings,
        runnable: runnable,
        running: running,
        hiding: hiding
    };

    if (hiding &&
        _myfilters &&
        _myfilters.hiding &&
        settings &&
        !settings.safari_content_blocking) {
        result.selectors = _myfilters.hiding.filtersFor(options.domain);
    }
    return result;
};

// Bounce messages back to content scripts.
if (!SAFARI) {
    emit_page_broadcast = (function() {
        var injectMap = {
            'top_open_whitelist_ui': {
                allFrames: false,
                include: [
                    "punycode.min.js",
                    "jquery/jquery.min.js",
                    "jquery/jquery-ui.custom.min.js",
                    "uiscripts/load_jquery_ui.js",
                    "uiscripts/top_open_whitelist_ui.js"
                ]
            },
            'top_open_blacklist_ui': {
                allFrames: false,
                include: [
                    "punycode.min.js",
                    "jquery/jquery.min.js",
                    "jquery/jquery-ui.custom.min.js",
                    "uiscripts/load_jquery_ui.js",
                    "uiscripts/blacklisting/overlay.js",
                    "uiscripts/blacklisting/clickwatcher.js",
                    "uiscripts/blacklisting/elementchain.js",
                    "uiscripts/blacklisting/blacklistui.js",
                    "uiscripts/top_open_blacklist_ui.js"
                ]
            },
            'send_content_to_back': {
                allFrames: true,
                include: [
                    "uiscripts/send_content_to_back.js"
                ]
            }
        };
        // Inject the required scripts to execute fn_name(parameter) in
        // the current tab.
        // Inputs: fn_name:string name of function to execute on tab.
        //         fn_name must exist in injectMap above.
        //         parameter:object to pass to fn_name.  Must be JSON.stringify()able.
        //         injectedSoFar?:int used to recursively inject required scripts.
        var executeOnTab = function(fn_name, parameter, injectedSoFar) {
            injectedSoFar = injectedSoFar || 0;
            var data = injectMap[fn_name];
            var details = { allFrames: data.allFrames };
            // If there's anything to inject, inject the next item and recurse.
            if (data.include.length > injectedSoFar) {
                details.file = data.include[injectedSoFar];
                chrome.tabs.executeScript(undefined, details, function() {
                    executeOnTab(fn_name, parameter, injectedSoFar + 1);
                });
            }
            // Nothing left to inject, so execute the function.
            else {
                var param = JSON.stringify(parameter);
                details.code = fn_name + "(" + param + ");";
                chrome.tabs.executeScript(undefined, details);
            }
        };

        // The emit_page_broadcast() function
        var theFunction = function(request) {
            executeOnTab(request.fn, request.options);
        };
        return theFunction;
    })();
}

// Open subscribe popup when new filter list was subscribed from site
launch_subscribe_popup = function(loc) {
    window.open(chrome.extension.getURL('pages/subscribe.html?' + loc),
                "_blank",
                'scrollbars=0,location=0,resizable=0,width=460,height=150');
}

// Open the resource blocker when requested from popup.
launch_resourceblocker = function(query) {
    openTab("pages/resourceblock.html" + query, true);
}

// Get the frameData for the 'Report an Ad' & 'Resource' page
get_frameData = function(tabId) {
    return frameData.get(tabId);
}

// Process requests from 'Resource' page
// Determine, whether requests have been whitelisted/blocked
process_frameData = function(fd) {
    for (var frameId in fd) {
        var frame = fd[frameId];
        var frameResources = frame.resources;
        for (var resource in frameResources) {
            var res = frameResources[resource];
            // We are processing selectors in resource viewer page
            if (res.elType === "selector") {
                continue;
            }
            res.blockedData = _myfilters.blocking.matches(res.url, res.elType, res.frameDomain, true, true);
        }
    }
    return fd;
}

// Add previously cached requests to matchCache
// Used by 'Resource' page
add_to_matchCache = function(cache) {
    _myfilters.blocking._matchCache = cache;
}

// Reset matchCache
// Used by 'Resource' page
// Returns: object with cached requests
reset_matchCache = function() {
    var matchCache = _myfilters.blocking._matchCache;
    _myfilters.blocking._matchCache = {};
    return matchCache;
}

// Return chrome.i18n._getL10nData() for content scripts who cannot
// call that function (since it loads extension files from disk.)
// Only defined in Safari.
get_l10n_data = (SAFARI ? chrome.i18n._getL10nData : undefined);


// BGcall DISPATCH
(function() {
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            if (request.command !== "call")
                return; // not for us
            if ((sender.tab === undefined) || (sender.tab === null))
                return;
            var fn = window[request.fn];
            request.args.push(sender);
            var result = fn.apply(window, request.args);
            sendResponse(result);
        }
    );
})();

// BROWSER ACTION AND CONTEXT MENU UPDATES
(function() {
    if (SAFARI)
        return;

    //TEMP: until crbug.com/60435 is fixed, check if chrome.tabs exists.
    //Otherwise the extension doesn't work (e.g. doesn't block ads)
    if (chrome.tabs) {
        chrome.tabs.onUpdated.addListener(function(tabid, changeInfo, tab) {
            if (tab.active && changeInfo.status === "loading")
                updateButtonUIAndContextMenus();
        });
        chrome.tabs.onActivated.addListener(function() {
            updateButtonUIAndContextMenus();
        });

        // Github Issue # 69 and 11
        if (OPERA) {
            chrome.tabs.onCreated.addListener(function(tab) {
                chrome.tabs.get(tab.id, function(tabDetails) {
                    // If tab is undefined (Which happens sometimes, weird),
                    // get out of the function
                    if (!tabDetails || !tabDetails.openerTabId) return;

                    // Should mean that tab is a popup or was
                    // opened through a link.

                    // Manually create the details to be passed to
                    // navigation target handler.
                    var details = {
                        sourceTabId: tabDetails.openerTabId,
                        sourceFrameId: 0,
                        tabId: tabDetails.id,
                        url: tabDetails.url || "about:blank",
                    }

                    // Call pop up handler.
                    onCreatedNavigationTargetHandler(details);
                });
            });
        }
    }
})();

if (get_settings().debug_logging)
    logging(true);

_myfilters = new MyFilters();
_myfilters.init();

// Check for a newer update on Edge
if (EDGE) {
    STATUS.checkLatestVersion();
}

createMalwareNotification = function() {
    if (!SAFARI &&
        chrome &&
        chrome.notifications &&
        storage_get('malware-notification')) {

        //get the current tab, so we only create 1 notification per tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length === 0) {
                return; // For example: only the background devtools or a popup are opened
            }

            var tab = tabs[0];
            if (sessionStorage.getItem("malwareNotification" + tab.id)) {
                //we've already notified the user, just return.
                return;
            } else {
                sessionStorage.setItem("malwareNotification" + tab.id, true);
            }
            var notificationOptions = {
                title: "AdBlock",
                iconUrl: chrome.extension.getURL('img/icon48.png'),
                type: 'basic',
                priority: 2,
                message: translate('malwarenotificationmessage'),
                buttons: [{title:translate('malwarenotificationlearnmore'),
                           iconUrl:chrome.extension.getURL('img/icon24.png')},
                          {title:translate('malwarenotificationdisablethesemessages'),
                           iconUrl:chrome.extension.getURL('img/icon24.png')}]
            }
            //OPERA currently doesn't support buttons on notifications, so remove them from the options.
            if (OPERA) {
                delete notificationOptions.buttons;
            } else {
                //But, Chrome does, so add button click handlers to process the button click events
                chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
                    if (buttonIndex === 0) {
                        openTab("http://help.getadblock.com/support/solutions/articles/6000055822-i-m-seeing-similar-ads-on-every-website-");
                    }
                    if (buttonIndex === 1) {
                        storage_set('malware-notification', false);
                    }
                });
            }
            // Pop up a notification to the user.
            chrome.notifications.create((Math.floor(Math.random() * 3000)).toString(), notificationOptions, function(id) {
                //do nothing in callback
            });
        });//end of chrome.tabs.query
    }//end of if
}//end of createMalwareNotification function

if (!SAFARI) {
    // Chrome blocking code.  Near the end so synchronous request handler
    // doesn't hang Chrome while AdBlock initializes.
    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequestHandler, {urls: ["http://*/*", "https://*/*"]}, ["blocking"]);
    chrome.tabs.onRemoved.addListener(frameData.removeTabId);
    // Popup blocking
    if (chrome.webNavigationn && chrome.webNavigation.onCreatedNavigationTarget)
        chrome.webNavigation.onCreatedNavigationTarget.addListener(onCreatedNavigationTargetHandler);

    var handleEarlyOpenedTabs = function(tabs) {
        log("Found", tabs.length, "tabs that were already opened");
        for (var i=0; i<tabs.length; i++) {
            var currentTab = tabs[i], tabId = currentTab.id;
            if (!frameData.get(tabId)) { // unknown tab
                currentTab.url = getUnicodeUrl(currentTab.url);
                frameData.track({url: currentTab.url, tabId: tabId, type: "main_frame"});
            }
            updateBadge(tabId);
            // TODO: once we're able to get the parentFrameId, call
            // chrome.webNavigation.getAllFrames to 'load' the subframes
        }
    }
    chrome.tabs.query({url: "http://*/*"}, handleEarlyOpenedTabs);
    chrome.tabs.query({url: "https://*/*"}, handleEarlyOpenedTabs);
}

// YouTube Channel Whitelist
// Script injection logic for Safari is done in safari_bg.js
if (!SAFARI) {
    var runChannelWhitelist = function(tabUrl, tabId) {
        if (parseUri(tabUrl).hostname === "www.youtube.com" &&
            get_settings().youtube_channel_whitelist &&
            !parseUri.parseSearch(tabUrl).ab_channel) {
            chrome.tabs.executeScript(tabId, {file: "ytchannel.js", runAt: "document_start"});
        }
    }

    chrome.tabs.onCreated.addListener(function(tab) {
        chrome.tabs.get(tab.id, function(tabs) {
            if (tabs && tabs.url && tabs.id) {
                runChannelWhitelist(tabs.url, tabs.id);
            }
        });
    });

    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        if (changeInfo.status === "loading") {
            chrome.tabs.get(tabId, function(tabs) {
                if (tabs && tabs.url && tabs.id) {
                    runChannelWhitelist(tabs.url, tabs.id);
                }
            });
        }
    });
}

// used by the Options pages, since they don't have access to setContentBlocker
function isSafariContentBlockingAvailable() {
    return (SAFARI &&
            safari &&
            safari.extension &&
            (typeof safari.extension.setContentBlocker === 'function'));
}


// DEBUG INFO

// Get debug info for bug reporting and ad reporting - returns an object
getDebugInfo = function() {

    // An object, which contains info about AdBlock like
    // subscribed filter lists, settings and other settings
    var the_debug_info = {
        filter_lists: [],
        settings: [],
        other_info: []
    }

    // Process subscribed filter lists
    var get_subscriptions = get_subscriptions_minus_text();
    for (var id in get_subscriptions) {
        if (get_subscriptions[id].subscribed) {
            the_debug_info.filter_lists.push(id);
            the_debug_info.filter_lists.push("  last updated: " + new Date(get_subscriptions[id].last_update).toUTCString());
        }
    }

    // Format info about filter lists properly
    the_debug_info.filter_lists = the_debug_info.filter_lists.join('\n');

    // Process custom filters & excluded filters
    var adblock_custom_filters = storage_get("custom_filters");

    if (adblock_custom_filters) {
        the_debug_info.custom_filters = adblock_custom_filters;
    }
    if (get_exclude_filters_text()) {
        the_debug_info.exclude_filters = get_exclude_filters_text();
    }

    // Process settings
    var settings = get_settings();
    for (setting in settings) {
        the_debug_info.settings.push(setting + ": " + JSON.stringify(settings[setting]) + "\n");
    }

    // We need to hardcode malware-notification setting,
    // because it isn't included in _settings object, but just in localStorage
    the_debug_info.settings.push("malware-notification: " + storage_get('malware-notification') + "\n");
    the_debug_info.settings = the_debug_info.settings.join('');

    // Find out AdBlock version
    var AdBlockVersion = chrome.runtime.getManifest().version;

    // Is this installed build of AdBlock the official one?
    var AdBlockBuild = function() {
        if (!SAFARI) {
            if (chrome.runtime.id === "pljaalgmajnlogcgiohkhdmgpomjcihk") {
                return "Beta";
            } else if (chrome.runtime.id === "gighmmpiobklfepjocnamgkkbiglidom" ||
                       chrome.runtime.id === "aobdicepooefnbaeokijohmhjlleamfj") {
                return "Stable";
            } else {
                return "Developer";
            }
        } else {
            if (safari.extension.baseURI.indexOf("com.betafish.adblockforsafari-UAMUU4S2D9") > -1) {
                return "Stable";
            } else {
                return "Developer";
            }
        }
    }

    // Push AdBlock version and build to |the_debug_info| object
    the_debug_info.other_info.push("AdBlock version number: " + AdBlockVersion + " " + AdBlockBuild());

    // Get & process last known error
    var adblock_error = storage_get("error");
    if (adblock_error) {
        the_debug_info.other_info.push("Last known error: " + adblock_error);
    }

    // Get & process userAgent
    the_debug_info.other_info.push("UserAgent: " + navigator.userAgent.replace(/;/,""));
    the_debug_info.other_info = the_debug_info.other_info.join("\n");
    return the_debug_info;
}

// Code for making a bug report
makeReport = function() {
    var body = [];
    var debugInfo = getDebugInfo();
    body.push(chrome.i18n.getMessage("englishonly") + "!");
    body.push("");
    body.push("Please answer the following questions so that we can process your bug report, otherwise, we may have to ignore it.");
    body.push("");
    body.push("**Can you provide detailed steps on how to reproduce the problem?**");
    body.push("");
    body.push("1. ");
    body.push("2. ");
    body.push("3. ");
    body.push("");
    body.push("**What should happen when you do the above steps**");
    body.push("");
    body.push("");
    body.push("**What actually happened?**");
    body.push("");
    body.push("");
    body.push("**Do you have any other comments? If you can, can you please attach a screenshot of the bug?**");
    body.push("");
    body.push("");
    body.push("--- The questions below are optional but VERY helpful. ---");
    body.push("");
    body.push("If unchecking all filter lists fixes the problem, which one filter" +
              "list must you check to cause the problem again after another restart?");
    body.push("");
    body.push("Technical Chrome users: Go to chrome://extensions ->" +
              "Developer Mode -> Inspect views: background page -> Console. " +
              "Paste the contents here:");
    body.push("");
    var out = encodeURIComponent(body.join('  \n'));

    return out;
};

// CatBlock specific code
channels = new Channels();

var addChannel = function(args) {
    return channels.add(args);
}

var removeChannel = function(id) {
    return channels.remove(id);
}

var getListings = function(id) {
    return channels.getListings(id);
}

var getGuide = function() {
    return channels.getGuide();
}

var randomListing = function(args) {
    return channels.randomListing(args);
}

var setEnabled = function(id, enabled) {
    return channels.setEnabled(id, enabled);
}

// Listens for message from CatBlock content script asking to load jQuery.
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.command === "inject_jquery") {
            if (!SAFARI) {
                chrome.tabs.executeScript(undefined, { allFrames: request.allFrames, file: "../jquery/jquery.min.js" },
                                          function() { sendResponse({});
                                                     });
            } else {
                safari.extension.addContentScriptFromURL(safari.extension.baseURI + "jquery/jquery.min.js", [], [], false);
            }
        }
    }
);

log("\n===FINISHED LOADING===\n\n");
