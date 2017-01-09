// Represents the checkbox controlling subscription to a specific filter list,
// as well as the UI that goes along with it (e.g. status label and removal link.)
// Inputs:
//   filter_list:object - An entry from a filterListSections array.
//   filter_list_type:string - A key from filterListSections describing the section
//       where this checkbox will appear, e.g. 'language_filter_list'.
//   index:int - The position in the section where this checkbox should appear.
//   container:jQuery - The DOM element for the section in which this checkbox
//       should appear.
class CheckboxForFilterList {
    constructor(filter_list, filter_list_type, index, container) {
        this._container = container;
        this._filter_list = filter_list;
        this._filter_list_type = filter_list_type;
        this._id = this._filter_list_type + "_" + index;

        this._div = $("<div></div>").
        addClass("subscription").
        addClass(this._filter_list_type).
        attr("name", this._filter_list.id).
        css("display", this._filter_list_type === "language_filter_list" ?
            (this._filter_list.subscribed ? "block" : "none") : "block");

        this._check_box = $("<input />").
        attr("type", "checkbox").
        attr("id", this._id).
        prop("checked", this._filter_list.subscribed ? true : null).
        addClass("filter_list_control");

        this._label = $("<label></label>").
        text(this._filter_list.label || this._filter_list.title || this._filter_list.url).
        attr("title", this._filter_list.url).
        attr("for", this._id);

        this._link = $("<a></a>").
        text(this._filter_list.label || this._filter_list.title).
        css("margin-left", "6px").
        css("font-size", "10px").
        css("display", $("#btnShowLinks").prop("disabled") ? "inline" : "none").
        attr("target", "_blank").
        attr("class", "linkToList").
        attr("data-URL", this._filter_list.url).
        attr("data-safariJSON_URL", this._filter_list.safariJSON_URL).
        click(function() {
            var safariJSON_URL = $(this).attr("data-safariJSON_URL");
            var url = $(this).attr("data-URL");

            // If the user has Safari content blocking enabled, change the URL to the content blocking rule URL
            if (optionalSettings &&
                optionalSettings.safari_content_blocking &&
                safariJSON_URL) {
                $(this).attr("href", safariJSON_URL);
                return;
            }
            $(this).attr("href", url);
        });

        this._infospan = $("<span></span>").
        addClass("subscription_info").
        text(this._filter_list.subscribed && !this._filter_list.last_update ? (translate("fetchinglabel")) : "");

        this._remove_filter_list_label = this._filter_list.user_submitted ? $("<a>").
        css("font-size", "10px").
        css("display", this._filter_list.subscribed ? "none" : "inline").
        css("padding-left", "10px").
        attr("href", "#").
        addClass("remove_filter_list").
        text(translate("removefromlist")).
        click(function() {
            event.preventDefault();
            var $parent = $(this).parent();
            var id = $parent.attr("name");
            SubscriptionUtil.unsubscribe(id, true);
            $parent.remove();
        }) : null;
    }

    // Bind checkbox on change event to handle subscribing and unsubscribing to
    // different filter lists.
    _bindActions() {
        this._check_box.
        change(function() {
            var parent = $(this).parent();
            var checked = $(this).is(":checked");
            $(".remove_filter_list", parent).
            css("display", checked ? "none" : "inline");
            var id = parent.attr("name");
            if (checked) {
                $(".subscription_info", parent).text(translate("fetchinglabel"));
                SubscriptionUtil.subscribe(id);
                delete FilterListUtil.cached_subscriptions[id].unsubscribed;
            } else {
                SubscriptionUtil.unsubscribe(id, false);
                $(".subscription_info", parent).
                text(translate("unsubscribedlabel"));
                delete FilterListUtil.cached_subscriptions[id].subscribed;
            }
            // If the checkbox that was clicked is the malware checkbox, then
            // add a checkbox to for the user to indicate if they wish to be notified of blocked malware
            if (id && id === "malware" && checked) {
                addMalwareNotificationDiv();
            } else if (id && id === "malware" && !checked) {
                $("#malware-notification-message-div").remove();
                BGcall("storage_set", "malware-notification", false);
            }
        });

        if (this._filter_list_type === "language_filter_list") {
            this._check_box.
            change(function() {
                var $this = $(this);
                $this.parent().toggle(500);
                if (!$this.is(":checked")) {
                    var index = $this.attr("id").split("_")[3];
                    var entry = filterListSections.language_filter_list.array[index];
                    var option = new OptionForFilterList(entry, index);
                    LanguageSelectUtil.insertOption(option.get(), index);
                }
            });
        }

        if (this._filter_list.user_submitted) {
            this._remove_filter_list_label.
            click(function(event) {
                event.preventDefault();
                var parent = $(this).parent();
                var id = parent.attr("name");
                SubscriptionUtil.unsubscribe(id, true);
                parent.remove();
            });
        }
    }

    // Create the actual check box div and append in the container.
    // Inputs:
    //   isChecked:boolean - Flag that will indicate that this checkbox is checked by default.
    createCheckbox(isChecked) {
        this._div.
        append(this._check_box).
        append(this._label).
        append(this._link).
        append(this._infospan).
        append(this._remove_filter_list_label);

        this._container.append(this._div);

        this._bindActions();

        if (isChecked) {
            this._check_box.prop("checked", true);
            this._check_box.trigger("change");
        }
    }
}


// Represents the option for language filter lists inside the language select.
// Inputs:
//   filter_list:object - An entry from a filterListSections array.
//   index:int - The position in the language select where this option should appear.
class OptionForFilterList {
    constructor(filter_list, index) {
        this._filter_list = filter_list;
        this._index = index;

        this._option = $("<option>", {
            value: this._filter_list.id,
            text: this._filter_list.label
        }).data("index", this._index);
    }

    // Returns the _option attribute.
    get() {
        return this._option;
    }
}


// Contains all filter lists and their respective containers.
var filterListSections = {
    adblock_filter_list: {
        array: [],
        container: $("#ad_blocking_list")
    },
    language_filter_list: {
        array: [],
        container: $("#language_list")
    },
    other_filter_list: {
        array: [],
        container: $("#other_filter_lists")
    },
    custom_filter_list: {
        array: [],
        container: $("#custom_filter_lists")
    }
};


// This class is in charge of creating the display per filter list type.
// Inputs:
//   filter_list_section:object - One of the objects in filterListSections.
//   filter_list_type:string - Will serve as the identifier for the corresponding filter list,
//      use the keys in filterListSections as its value.
class SectionHandler {
    constructor(filter_list_section, filter_list_type) {
        this._cached_subscriptions = filter_list_section.array;
        this._$section = filter_list_section.container;
        this._filter_list_type = filter_list_type;
    }

    // Organize each container for checkboxes.
    _organize() {
        for (var i = 0; i < this._cached_subscriptions.length; i++) {
            var filter_list = this._cached_subscriptions[i];
            var checkbox = new CheckboxForFilterList(filter_list, this._filter_list_type, i, this._$section);
            checkbox.createCheckbox();
        }
    }

    // Initialization call. Calls _organize to start displaying things.
    initSection() {
        this._organize();
    }
}


// Utility class for filter lists.
class FilterListUtil {
    constructor() {
    }

    static sortFilterListArrays() {
        for (var filter_list in filterListSections) {
            filterListSections[filter_list].array.sort(function(a,b) {
                return a.label > b.label ? 1 : (a.label === b.label ? 0 : -1);
            });
        }
    }

    // Prepare filterListSections.
    // Inputs:
    //    subs:object - Map for subscription lists taken from the background.
    static getFilterListType(filter_list) {
        var filter_list_type;
        if (filter_list.id === "adblock_custom" ||
            filter_list.id === "easylist") {
            filter_list_type = "adblock_filter_list";
        } else if (filter_list.id === "easyprivacy" || filter_list.id === "antisocial" ||
                   filter_list.id === "malware" || filter_list.id === "annoyances" ||
                   filter_list.id === "warning_removal") {
            filter_list_type = "other_filter_list";
        } else if (filter_list.user_submitted) {
            filter_list_type = "custom_filter_list";
        } else {
            filter_list_type = "language_filter_list";
        }
        return filter_list_type;
    }

    static prepareSubscriptions(subs) {
        FilterListUtil.cached_subscriptions = subs;
        for (var id in subs) {
            var entry = subs[id];
            // TODO: Edge throws an exception if the translate msg isn't found.
            // Since, the user can enter custom filter URLs, translate will fail to find it.
            try {
                entry.label = translate("filter" + id);
            } catch(ex) {
                // Ignore error
                entry.label = "";
            }
            entry.id = id;
            var filter_list_type = FilterListUtil.getFilterListType(entry);
            filterListSections[filter_list_type].array.push(entry);
        }
        FilterListUtil.sortFilterListArrays();
    }

    // Returns the subscription info object for the custom filter list specified by |url|,
    // or undefined if that custom filter list does not exist.
    // Inputs:
    //   url:string - Url for uploaded custom filter list.
    static checkUrlForExistingFilterList(url) {
        var cached_subscriptions = FilterListUtil.cached_subscriptions;
        for (var id in cached_subscriptions) {
            if (url === cached_subscriptions[id].url) {
                return cached_subscriptions[id];
            }
        }
        return undefined;
    }

    // Updates info text for each filter list.
    static updateSubscriptionInfoAll() {
        var cached_subscriptions = FilterListUtil.cached_subscriptions;
        for (var id in cached_subscriptions) {
            var div = $("[name='" + id + "']");
            var subscription = cached_subscriptions[id];
            var infoLabel = $(".subscription_info", div);
            var text = infoLabel.text();
            var last_update = subscription.last_update;
            // If filter list is invalid, skip it.
            if (infoLabel.text() === translate("invalidListUrl")) {
                continue;
            }
            if (subscription.last_update_failed_at) {
                if (subscription.user_submitted &&
                    translate("failedtofetchfilter") === infoLabel.text()) {
                    text = translate("invalidListUrl");
                    $("input", div).prop("disabled", true);
                } else {
                    text = translate("failedtofetchfilter");
                }
            } else if (last_update) {
                var how_long_ago = Date.now() - last_update;
                var seconds = Math.round(how_long_ago / 1000);
                var minutes = Math.round(seconds / 60);
                var hours = Math.round(minutes / 60);
                var days = Math.round(hours / 24);
                var text = "";
                if (seconds < 10) {
                    text += translate("updatedrightnow");
                } else if (seconds < 60) {
                    text += translate("updatedsecondsago", [seconds.toString()]);
                } else if (minutes === 1) {
                    text += translate("updatedminuteago");
                } else if (minutes < 60) {
                    text += translate("updatedminutesago", [minutes.toString()]);
                } else if (hours === 1) {
                    text += translate("updatedhourago");
                } else if (hours < 24) {
                    text += translate("updatedhoursago", [hours.toString()]);
                } else if (days === 1) {
                    text += translate("updateddayago");
                } else {
                    text += translate("updateddaysago", [days.toString()]);
                }
            }
            infoLabel.text(text);
        }
    }

    // Update checkbox for the filter list according to it's current state.
    // Inputs:
    //    filter_list:object - Filter list that owns the check box to be updated.
    //    id:String - Id of the filter list to be updated, also the name of the containing div in display.
    static updateCheckbox(filter_list, id) {
        var containing_div = $("div[name='" + id + "']");
        var checkbox = $(containing_div).find("input");
        // Check if subscribed and checkbox staus is equal, if not, update checkbox status according to subscribed status.
        if (checkbox.is(":checked") !== filter_list.subscribed) {
            checkbox.prop("checked", filter_list.subscribed ? true : null);
            // Force update current info label since status is already updated in the background.
            $(".subscription_info", containing_div).text(filter_list.subscribed ? translate("fetchinglabel") : translate("unsubscribedlabel"));
            // If the filter is of language list type, check if subscribed and checkbox visibility matches, if not, update visibility.
            if (containing_div.parent().attr("id") === "language_list" && filter_list.subscribed !== containing_div.is(":visible")) {
                containing_div.toggle(500);
                var index = checkbox.attr("id").split("_")[3];
                // After updating visibility, update Language Selectbox too.
                if (filter_list.subscribed) {
                    $("#language_select").find("option")[parseInt(index) + 1].remove();
                } else {
                    var newOption = OptionForFilterList(filter_list, index);
                    if (newOption) {
                        LanguageSelectUtil.insertOption(newOption.get(), index);
                    }
                }
            }
        }
    }
}


// Utility class for the language select.
class LanguageSelectUtil {

    // Insert option at specified index in the language select.
    // Inputs:
    //   option:OptionForFilterList - Option to be inserted.
    //   index:int - Where to insert the option.
    static insertOption(option, index) {
        var $language_select = $("#language_select");
        var options = $language_select.find("option");
        var i;
        for (i = 0; i < options.length; i++) {
            var list_option_index = options.eq(i).data("index");
            if (list_option_index && parseInt(list_option_index) > parseInt(index)) {
                break;
            }
        }
        if (options.eq(i).length > 0) {
            options.eq(i).before(option);
        } else {
            $language_select.append(option);
        }
    }

    // Puts all unsubscribed language filter lists into the language select,
    // and binds an onChange event on the select to subscribe to the selected
    // filter list.
    static init() {
        var language_filter_list_arr = filterListSections.language_filter_list.array;
        for (var i = 0; i < language_filter_list_arr.length; i++) {
            var language_filter_list = language_filter_list_arr[i];
            if (!language_filter_list.subscribed) {
                var option = new OptionForFilterList(language_filter_list, i);
                LanguageSelectUtil.insertOption(option.get(), i);
            }
        }

        $("#language_select").change(function() {
            var $this = $(this);
            var selected_option = $this.find(":selected");
            var index = $(selected_option).data("index");
            var entry = language_filter_list_arr[index];
            if (entry) {
                $this.find("option:first").prop("selected", true);
                selected_option.remove();
                var $checkbox = $("[name='" + entry.id + "']").find("input");
                $checkbox.prop("checked", true);
                $checkbox.trigger("change");
            }
        });
    }

    // Trigger change event to language select using one of the entries.
    // Input:
    //   filter_list:object - Filter list to select.
    static triggerChange(filter_list) {
        var $language_select = $("#language_select");
        $language_select.val(filter_list.id);
        $language_select.trigger("change");
    }
}


// Utility class for Subscriptions.
class SubscriptionUtil {

    // Returns true if the user knows what they are doing, subscribing to many
    // filter lists.
    static validateOverSubscription() {
        if ($(":checked", "#filter_list_subscriptions").length <= 6) {
            return true;
        }
        return confirm(translate("catblock_you_know_thats_a_bad_idea_right"));
    }

    // Subscribe to the filter list with the given |id|.
    // Input:
    //   id:string - Id of the filter list to be subscribed to.
    static subscribe(id, title) {
        if (!SubscriptionUtil.validateOverSubscription()) {
            return;
        }
        var parameters = {id: id, title: title};
        if (FilterListUtil.cached_subscriptions[id] && FilterListUtil.cached_subscriptions[id].requiresList) {
            parameters.requires = FilterListUtil.cached_subscriptions[id].requiresList;
        }
        SubscriptionUtil._updateCacheValue(id);
        BGcall("subscribe", parameters);
    }

    // Unsubscribe to the filter list with the given |id|.
    // Input:
    //   id:string - Id of the filter list to be subscribed to.
    //   del:boolean - Flag to indicate if filter list should be deleted in the background.
    static unsubscribe(id, del) {
        SubscriptionUtil._updateCacheValue(id);
        BGcall("unsubscribe", {id:id, del:del});
    }

    // Update the given filter list in the cached list.
    // Input:
    //   id:string - Id of the filter list to be updated.
    static _updateCacheValue(id) {
        var sub = FilterListUtil.cached_subscriptions[id];
        if (sub) {
            delete sub.last_update_failed_at;
            delete sub.last_update;
        }
    }
}


// Utility class for custom filter list upload box.
class CustomFilterListUploadUtil {

    // Perform the subscribing part and creating checkbox for custom filter lists.
    // Inputs:
    //   url:string - Url for the custom filter list.
    //   subscribe_to:string - The id of the custom filter list.
    static _performUpload(url, subscribe_to) {
        SubscriptionUtil.subscribe(subscribe_to);
        var entry = {
            id: subscribe_to,
            url: url,
            subscribed: true,
            unsubscribe: true,
            user_submitted: true,
            label: ""
        };
        FilterListUtil.cached_subscriptions[entry.id] = entry;
        var custom_filter_list = filterListSections.custom_filter_list;
        var checkbox = new CheckboxForFilterList(entry, "custom_filter_list", custom_filter_list.array.length, custom_filter_list.container);
        checkbox.createCheckbox(true);
    }

    // When a user enters a URL in the custom filter list textbox for a known filter list,
    // this method clicks the correct filter list checkbox/select option for him instead.
    // Input:
    //   existing_filter_list:object - Filter list whose URL was entered by the user.
    static _updateExistingFilterList(existing_filter_list) {
        var containing_div = $("div[name='" + existing_filter_list.id + "']");
        if (containing_div.length < 1) {
            // If the checkbox does not exist but there is an existing filter list,
            // then recreate the checkbox
            var filter_list_type = FilterListUtil.getFilterListType(existing_filter_list);
            var filter_list_array = filterListSections[filter_list_type].array;
            var index = filter_list_array.indexOf(existing_filter_list);
            if (index < 0) {
                index = filter_list_array.length;
                filter_list_array.push(existing_filter_list);
            }
            var checkboxForFilterList = new CheckboxForFilterList(existing_filter_list, filter_list_type, index, filterListSections[filter_list_type].container);
            checkboxForFilterList.createCheckbox();
            containing_div = $("div[name='" + existing_filter_list.id + "']");
        }

        var checkbox = $(containing_div).find("input");

        if (!checkbox.is(":checked")) {
            if (checkbox.attr("id").indexOf("language_filter_list") > 0) {
                LanguageSelectUtil.triggerChange(existing_filter_list);
            } else {
                checkbox.prop("checked", true);
                checkbox.trigger("change");
            }
        }
    }

    // Binds events for key press 'enter' and click for upload box.
    static bindControls() {
        $("#btnNewSubscriptionUrl").click(function() {
            var url = $("#txtNewSubscriptionUrl").val();
            var abp_regex = /^abp.*\Wlocation=([^\&]+)/i;
            if (abp_regex.test(url)) {
                url = url.match(abp_regex)[1]; // The part after 'location='.
                url = unescape(url);
            }
            url = url.trim();
            var subscribe_to = "url:" + url;

            var existing_filter_list = FilterListUtil.checkUrlForExistingFilterList(url);

            if (existing_filter_list) {
                CustomFilterListUploadUtil._updateExistingFilterList(existing_filter_list);
            } else {
                if (/^https?\:\/\/[^\<]+$/.test(url)) {
                    CustomFilterListUploadUtil._performUpload(url, subscribe_to);
                } else {
                    alert(translate("failedtofetchfilter"));
                }
            }
            $("#txtNewSubscriptionUrl").val("");
        });

        // Pressing enter will add the list too.
        $("#txtNewSubscriptionUrl").keypress(function(event) {
            if (event.keyCode === 13) {
                event.preventDefault();
                $("#btnNewSubscriptionUrl").click();
            }
        });
    }
}

// Add a checkbox to for the user to indicate if they wish to be notified of blocked malware
function addMalwareNotificationDiv() {
    if (document.getElementById("malware-notification-message-div")) {
        return; //already exists, don't add it again.
    }
    if (!SAFARI &&
        chrome &&
        chrome.notifications) {
        BGcall("storage_get", "malware-notification", function(notify) {
            var newDiv = $("<div>").
            attr("id", "malware-notification-message-div");
            var newInput = $("<input />").
            attr("type", "checkbox").
            attr("id", "malware-notification-message").
            css("margin-left", "25px").
            prop("checked", notify ? true : null);
            var newLabel = $("<label>").
            text(translate("catblock_malwarenotificationcheckboxmessage")).
            attr("for", "malware-notification-message");
            var betaLabel = $("<label>").
            text(translate("betalabel")).
            attr("i18n", "betalabel").
            addClass("betalabel").
            css("padding-left", "5px");
            newDiv.append(newInput).append(newLabel).append(betaLabel);

            $("div[name='malware']").after(newDiv);

            $("#malware-notification-message").click(function() {
                var checked = $(this).is(":checked");
                BGcall("storage_set", "malware-notification", checked);
            });
        });
    }
}

$(function() {
    // Retrieves list of filter lists from the background.
    BGcall("get_subscriptions_minus_text", function(subs) {

        // Initialize page using subscriptions from the background.
        // Copy from update subscription list + setsubscriptionlist
        FilterListUtil.prepareSubscriptions(subs);

        for (var id in filterListSections) {
            var sectionHandler = new SectionHandler(filterListSections[id], id);
            sectionHandler.initSection();
        }

        LanguageSelectUtil.init();
        CustomFilterListUploadUtil.bindControls();

        // If the user is subscribed to malware, add the checkbox for notifications
        if (subs && subs.malware && subs.malware.subscribed) {
            addMalwareNotificationDiv();
        }
    });

    window.setInterval(function() {
        FilterListUtil.updateSubscriptionInfoAll();
    }, 1000);

    $("#btnUpdateNow").click(function() {
        $(this).prop("disabled", true);
        BGcall("update_subscriptions_now");
        setTimeout(function() {
            $("#btnUpdateNow").prop("disabled", false);
        }, 300000); // Re-enable update button after 5 minutes.
    });

    $("#btnShowLinks").click(function() {
        $(".linkToList").fadeIn("slow");
        $("#btnShowLinks").remove();
    });

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.command !== "filters_updated") {
            return;
        }
        BGcall("get_subscriptions_minus_text", function(subs) {
            var cached_subscriptions = FilterListUtil.cached_subscriptions;
            for (var id in cached_subscriptions) {
                var entry = subs[id];
                if (entry) {
                    // Update checkbox according to the value of the subscribed field
                    FilterListUtil.updateCheckbox(entry, id);
                    // If entry is subscribed, update last_update_failed_at and last_update field
                    if (entry.subscribed) {
                        if (entry.last_update && entry.last_update_failed_at) {
                            // If update is more recent than failed update, remove last_update_failed_at field,
                            // otherwise, remove last_update field
                            if (parseInt(entry.last_update) > parseInt(entry.last_update_failed_at)) {
                                delete subs[id].last_update_failed_at;
                            } else {
                                delete subs[id].last_update;
                            }
                        }

                        // Update last_update_failed_at and last_update field for the entry in cached subscriptions
                        if (entry.last_update_failed_at) {
                            cached_subscriptions[id].last_update_failed_at = entry.last_update_failed_at;
                        } else if (entry.last_update) {
                            cached_subscriptions[id].last_update = entry.last_update;
                        }
                    }
                }
            }
        });
        sendResponse({});
    });
});