function emit_page_broadcast(request) {
    safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("page-broadcast", request);
}

// frameData object for Safari
var frameData = (function() {
    return {
        // Get frameData for the tab.
        // Input:
        //   tabId: Integer - id of the tab you want to get
        get: function(tabId) {
            return frameData[tabId] || {};
        },

        // Create a new frameData
        // Input:
        //   tabId: Integerc - id of the tab you want to add in the frameData
        create: function(tabId, url, domain) {
            return frameData._initializeMap(tabId, url, domain);
        },
        // Reset a frameData
        // Inputs:
        //   tabId: Integer - id of the tab you want to add in the frameData
        //   url: new URL for the tab
        reset: function(tabId, url) {
            var domain = new parseURI(url).hostname;
            return frameData._initializeMap(tabId, url, domain);
        },
        // Initialize map
        // Inputs:
        //   tabId: Integer - id of the tab you want to add in the frameData
        //   url: new URL for the tab
        //   domain: domain of the request
        _initializeMap: function(tabId, url, domain) {
            var tracker = frameData[tabId];

            // We need to handle IDN URLs properly
            url = new parseURI(url).href;
            domain = parseURI.getUnicodeDomain(domain);

            var shouldTrack = !tracker || tracker.url !== url;
            if (shouldTrack) {
                frameData[tabId] = {
                    resources: {},
                    domain: domain,
                    url: url
                };
            }
            return tracker;
        },
        // Store resource
        // Inputs:
        //   tabId: Numeric - id of the tab you want to delete in the frameData
        //   url: url of the resource
        storeResource: function(tabId, url, elType) {
            if (!get_settings().show_advanced_options) {
                return;
            }
            var data = this.get(tabId);
            if (data !== undefined &&
                data.resources !== undefined) {
                data.resources[elType + ":|:" + url] = null;
            }
        },
        // Delete tabId from frameData
        // Input:
        //   tabId: Numeric - id of the tab you want to delete in the frameData
        close: function(tabId) {
            delete frameData[tabId];
        }
    };
})();

// True blocking support.
safari.application.addEventListener("message", function(messageEvent) {
    if (messageEvent.name === "request" &&
        messageEvent.message.data.args.length >= 2 &&
        messageEvent.message.data.args[0] &&
        messageEvent.message.data.args[1] &&
        messageEvent.message.data.args[1].tab &&
        messageEvent.message.data.args[1].tab.url) {
        var args = messageEvent.message.data.args;
        if (!messageEvent.target.url ||
            messageEvent.target.url === args[1].tab.url) {
            frameData.create(messageEvent.target.id, args[1].tab.url, args[0].domain);
        } else if (messageEvent.target.url === frameData.get(messageEvent.target.id).url) {
            frameData.reset(messageEvent.target.id, args[1].tab.url);
        }
        return;
    }

    if (messageEvent.name !== "canLoad") {
        return;
    }

    // In theory, this code shouldn't be needed...
    if (get_settings().safari_content_blocking) {
        return;
    }

    var tab = messageEvent.target;
    var isPopup = messageEvent.message.isPopup;
    var frameInfo = messageEvent.message.frameInfo;
    chrome._tabInfo.notice(tab, frameInfo);
    var sendingTab = chrome._tabInfo.info(tab, frameInfo.visible);

    if (adblock_is_paused() || page_is_unblockable(sendingTab.url) ||
        page_is_whitelisted(sendingTab.url)) {
        messageEvent.message = true;
        return;
    }

    if (!isPopup) {
        var url = new parseURI(messageEvent.message.url).href;
        var elType = messageEvent.message.elType;
        var frameDomain = parseURI.getUnicodeDomain(messageEvent.message.frameDomain);
        var isMatched = url && (_myfilters.blocking.matches(url, elType, frameDomain));
        if (isMatched) {
            log("SAFARI TRUE BLOCK " + url + ": " + isMatched);
        }
    } else {
        // Popup blocking support
        if (messageEvent.message.referrer) {
            var isMatched = _myfilters.blocking.matches(sendingTab.url, ElementTypes.popup,
                                                        new parseURI(messageEvent.message.referrer).hostname);
            if (isMatched) {
                tab.close();
            }
        }
    }

    frameData.storeResource(tab.id, url, elType);

    messageEvent.message = !isMatched;
}, false);

// Code for creating popover
var ABPopover = safari.extension.createPopover("CatBlock", safari.extension.baseURI + "button/popup.html");

function setPopover(popover) {
    for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
        safari.extension.toolbarItems[i].popover = popover;
        var toolbarItem = safari.extension.toolbarItems[i];
        toolbarItem.popover = popover;
        toolbarItem.toolTip = "CatBlock"; // change the tooltip on Safari 5.1+
        toolbarItem.command = null;
    }
}

// Code for removing popover
function removePopover(popover) {
    safari.extension.removePopover(popover);
}

// Reload popover when opening/activating tab, or URL was changed
safari.application.addEventListener("activate", function(event) {
    if (event.target instanceof SafariBrowserTab) {
        safari.extension.popovers[0].contentWindow.location.reload();
        // Hide popover, when new tab has been opened
        if (ABPopover.visible) {
            ABPopover.hide();
        }
    }
}, true);

safari.application.addEventListener("popover", function() {
    safari.extension.popovers[0].contentWindow.location.reload();
}, true);

safari.application.addEventListener("validate", function(event) {
    if (event.target instanceof SafariExtensionToolbarItem) {
        var item = event.target;
        if (item.browserWindow && !item.popover) {
            // Check if only this item lacks a popover (which means user just opened a new window) or there are multiple items
            // lacking a popover (which only happens on browser startup or when the user removes CatBlock toolbar item and later
            // drags it back).
            var uninitializedItems = 0;
            for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
                var item = safari.extension.toolbarItems[i];
                if (!item.popover) {
                    uninitializedItems++;
                }
            }
            if (uninitializedItems > 1) {
                // Browser startup or toolbar item added back to the toolbar. To prevent memory leaks in the second case,
                // we need to remove all previously created popovers.
                for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
                    removePopover(ABPopover);
                }
                // And now recreate the popover for toolbar items in all windows.
                setPopover(ABPopover);
            } else {
                // New window has been opened, create popover for it
                setPopover(ABPopover);
            }
        }
    }
}, true);


// Remove the popover when the window closes and
// cached data stored in frameData
safari.application.addEventListener("close", function(event) {
    // Remove cached data for tab
    frameData.close(event.target.id);

    // Remove the popover when the window closes so we don't leak memory.
    if (event.target instanceof SafariBrowserWindow) { // don't handle tabs
        for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
            var item = safari.extension.toolbarItems[i];
            if (item.browserWindow === event.target) {

                // Safari docs say that we must detach popover from toolbar items before removing.
                item.popover = null;

                // Remove the popover.
                removePopover(ABPopover);
                break;
            }
        }
    }
}, true);

// Add and remove the specific content script based on the safari_content_blocking setting
function set_content_scripts() {
    if (get_settings().safari_content_blocking) {
        safari.extension.addContentScriptFromURL(safari.extension.baseURI + "js/adblock_safari_contentblocking.js", [], [], false);
        safari.extension.removeContentScript(safari.extension.baseURI + "js/adblock_safari_beforeload.js");
    } else {
        safari.extension.addContentScriptFromURL(safari.extension.baseURI + "js/adblock_safari_beforeload.js", [], [], false);
        safari.extension.removeContentScript(safari.extension.baseURI + "js/adblock_safari_contentblocking.js");
    }
}
set_content_scripts();

safari.application.addEventListener("beforeNavigate", function(event) {

    // Remove bandaids.js from YouTube.com when a user pauses CatBlock or if the enabled click to flash compatibility mode
    if (/youtube.com/.test(event.url) && (is_adblock_paused() || (get_settings().clicktoflash_compatibility_mode === true))) {
        safari.extension.removeContentScript(safari.extension.baseURI + "js/bandaids.js");
    }
    // YouTube Channel Whitelist
    if (/youtube.com/.test(event.url) && get_settings().youtube_channel_whitelist && !parseURI.parseSearch(event.url).ab_channel) {
        safari.extension.addContentScriptFromURL(safari.extension.baseURI + "js/ytchannel.js", [], [], false);
    } else {
        safari.extension.removeContentScript(safari.extension.baseURI + "js/ytchannel.js");
    }
}, true);

// Set commands for whitelist, blacklist and undo my blocks wizards
safari.application.addEventListener("command", function(event) {
    var browserWindow;

    if (event.target.browserWindow) {
        // Context menu item event or button event on Safari 5.0, browserWindow is available in event.target.
        browserWindow = event.target.browserWindow;
    } else {
        // browserWindow is not available in event.target for context menu item events in Safari 5.1.
        browserWindow = safari.application.activeBrowserWindow;
    }

    var command = event.command;

    if (command === "CatBlockOptions") {
        openTab("options/index.html", false, browserWindow);
    } else if (command === "undo-last-block") {
        var tab = browserWindow.activeTab;
        var host = new parseURI(tab.url).hostname;
        confirm_removal_of_custom_filters_on_host(host, tab);
    } else if (command in {"show-whitelist-wizard": 1, "show-blacklist-wizard": 1, "show-clickwatcher-ui": 1 }) {
        browserWindow.activeTab.page.dispatchMessage(command);
    }
}, false);

function dispatchMessage(command) {
    safari.application.activeBrowserWindow.activeTab.page.dispatchMessage(command);
}

// Open Options page upon settings checkbox click.
safari.extension.settings.openCatBlockOptions = false;
safari.extension.settings.addEventListener("change", function(e) {
    if (e.key === "openCatBlockOptions") {
        openTab("options/index.html");
    }
}, false);

// Add context menus
safari.application.addEventListener("contextmenu", function(event) {
    if (!event.userInfo) {
        return;
    }

    if (!get_settings().show_context_menu_items || adblock_is_paused()) {
        return;
    }

    var url = event.target.url;

    if (page_is_unblockable(url) || page_is_whitelisted(url)) {
        return;
    }

    event.contextMenu.appendContextMenuItem("show-blacklist-wizard", translate("block_this_ad"));
    event.contextMenu.appendContextMenuItem("show-clickwatcher-ui", translate("block_an_ad_on_this_page"));

    var host = new parseURI(url).hostname;
    if (count_cache.getCustomFilterCount(host)) {
        event.contextMenu.appendContextMenuItem("undo-last-block", translate("undo_last_block"));
    }
}, false);
