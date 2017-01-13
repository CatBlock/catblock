// Chrome to Safari port
// Author: Michael Gundlach (gundlach@gmail.com)
// License: GPLv3 as part of code.getadblock.com
//          or MIT if GPLv3 conflicts with your code's license.
//
// Porting library to make Chrome extensions work in Safari.
// To use: Add as the first script loaded in your Options page,
// your background page, your Chrome manifest.json, and your
// Safari Info.plist (created by the Extensions Builder).
//
// Then you can use chrome.* APIs as usual, and check the SAFARI
// global boolean variable to see if you're in Safari or Chrome
// for doing browser-specific stuff.  The safari.* APIs will
// still be available in Safari, and the chrome.* APIs will be
// unchanged in Chrome.

if (typeof SAFARI === "undefined") {
    (function() {
        // True in Safari, false in Chrome.
        SAFARI = (function() {
            if (navigator.userAgent.indexOf("Edge") > -1) {
                return false;
            }
            if (typeof safari === "undefined" && typeof chrome === "undefined") {
                // Safari bug: window.safari undefined in iframes with JS src in them.
                // Must get it from an ancestor.
                var w = window;
                while (w.safari === undefined && w !== window.top) {
                    w = w.parent;
                }
                window.safari = w.safari;
            }
            return (typeof safari !== "undefined");
        })();

        if (SAFARI) {

            var isOnGlobalPage = !!safari.extension.bars;

            // Return the object on which you can add/remove event listeners.
            // If there isn't one, don't explode.
            function listeningContext() {
                if (safari.self && safari.self.addEventListener) {
                    return safari.self;
                }
                if (safari.application && safari.application.addEventListener) {
                    return safari.application;
                }
                console.log("No add/remove event listener possible at this location!");
                console.trace();
                return {
                    addEventListener: function() {},
                    removeEventListener: function() {}
                };
            }
            function listenFor(messageName, handler) {
                function listener(messageEvent) {
                    if (messageEvent.name === messageName) {
                        handler(messageEvent);
                    }
                }
                listeningContext().addEventListener("message", listener, false);
                return listener;
            }
            function removeListener(listener) {
                listeningContext().removeEventListener("message", listener, false);
            }
            // Return the object on which you can dispatch messages -- globally, or on the
            // messageEvent if specified.  If there isn't one, don't explode.
            // Make this globally available (don't use 'var') as it is used outside port.js
            function dispatchContext(messageEvent) {
                // Can we dispatch on the messageEvent target?
                var m = messageEvent;
                if (m && m.target && m.target.page && m.target.page.dispatchMessage) {
                    return m.target.page;
                }
                // Are we in some context where safari.self works, whatever that is?
                var s = safari.self;
                if (s && s.tab && s.tab.dispatchMessage) {
                    return s.tab;
                }
                // Are we in the global page sending to the active tab?
                var b = (safari.application && safari.application.activeBrowserWindow);
                var p = (b && b.activeTab && b.activeTab.page);
                if (p && p.dispatchMessage) {
                    return p;
                }
                console.log("No dispatchMessage possible at this location!");
                console.trace();
                return {
                    dispatchMessage: function(msg, data) {
                        console.warn("Failed to call dispatchMessage(", msg, ",", data, ")");
                        console.trace();
                    }
                };
            }

            // Replace the 'chrome' object with a Safari adapter.
            chrome = {
                runtime: {
                    getBackgroundPage: function(callback) {
                        try {
                            callback(safari.extension.globalPage.contentWindow);
                        } catch(e) {
                            // BG page is not accessible from other pages
                            // other than self & popup.html
                            callback(undefined);
                        }
                    },

                    getManifest: function() {
                        var xhr = new XMLHttpRequest();
                        xhr.open("GET", chrome.runtime.getURL("manifest.json"), false);
                        xhr.send();
                        var object = JSON.parse(xhr.responseText);
                        return object;
                    },

                    getURL: function(path) {
                        return safari.extension.baseURI + path;
                    },

                    sendMessage: (function() {
                        // Where to call .dispatchMessage() when sendMessage is called.
                        var dispatchTargets = [];
                        if (!isOnGlobalPage) {
                            // In a non-global context, the dispatch target is just the local
                            // object that lets you call .dispatchMessage().
                            dispatchTargets.push(dispatchContext());
                        } else {
                            // In the global context, we must call .dispatchMessage() wherever
                            // someone has called .onMessage().  There's no good way to get at
                            // them directly, though, so .onMessage calls *us*, so we get access
                            // to a messageEvent object that points to their page that we can
                            // call .dispatchMessage() upon.
                            listenFor("onMessage registration", function(messageEvent) {
                                var context = dispatchContext(messageEvent);
                                if (dispatchTargets.indexOf(context) === -1) {
                                    dispatchTargets.push(context);
                                }
                            });
                        }

                        // Dispatches a message to a list of recipients.  Calls the callback
                        // only once, using the first response received from any recipient.
                        function theFunction(data, callback) {
                            var callbackToken = "callback" + Math.random();

                            // Dispatch to each recipient.
                            dispatchTargets.forEach(function(target) {
                                var message = {
                                    data: data,
                                    frameInfo: chrome._tabInfo.gatherFrameInfo(),
                                    callbackToken: callbackToken
                                };
                                target.dispatchMessage("message", message);
                            });

                            // Listen for a response.  When we get it, call the callback and stop
                            // listening.
                            var listener = listenFor("response", function(messageEvent) {
                                if (messageEvent.message.callbackToken !== callbackToken) {
                                    return;
                                }
                                // Must wrap this call in a timeout to avoid crash, per Safari team
                                window.setTimeout(function() {
                                    removeListener(listener);
                                }, 0);
                                if (callback) {
                                    callback(messageEvent.message.data);
                                }
                            });
                        }
                        return theFunction;
                    })(),

                    onMessage: {
                        addListener: function(handler) {
                            // If listening for messages from the global page, we must call the
                            // global page so it can get a messageEvent through which to send
                            // messages to us.
                            if (!isOnGlobalPage) {
                                dispatchContext().dispatchMessage("onMessage registration", {});
                            }

                            listenFor("message", function(messageEvent) {
                                var message = messageEvent.message.data;

                                var sender = {}; // Empty in onMessage in non-global contexts.
                                if (isOnGlobalPage) { // But filled with sender data otherwise.
                                    var tab = messageEvent.target;
                                    var frameInfo = messageEvent.message.frameInfo;
                                    chrome._tabInfo.notice(tab, frameInfo);
                                    sender.tab = chrome._tabInfo.info(tab, frameInfo.visible);
                                    // Filled with URL of frame.
                                    sender.url = frameInfo.url;
                                }

                                function sendResponse(dataToSend) {
                                    var responseMessage = { callbackToken: messageEvent.message.callbackToken, data: dataToSend };
                                    dispatchContext(messageEvent).dispatchMessage("response", responseMessage);
                                }
                                handler(message, sender, sendResponse);
                            });
                        }
                    }
                },

                // Helper object to ensure that tabs sending messages to the global page
                // get some extra attributes for the global page to use:
                //   id: an ID assigned by us so we can refer to the tab by ID elsewhere.
                //   visible_url: the URL of the top-level frame in the tab, if any.
                //   invisible_url: the URL of the top-level frame in the invisible page
                //                  being preloaded by the tab, if any (new in Safari 6.1).
                //
                // We are forced to store the *_url properties because the Safari API
                // doesn't currently give us a messageEvent.target.page.url property.  See
                // Issue #29.
                _tabInfo: {
                    // Returns an object that can be passed to chrome._tabInfo.notice().
                    //
                    // Called by a frame sending a message to the global page.
                    gatherFrameInfo: function() {
                        return {
                            visible: !document.hidden,
                            top_level: (window === window.top),
                            url: document.location.href
                        };
                    },

                    // Tab objects are destroyed when no one has a reference to them, so we
                    // keep a list of them, lest our data get lost.
                    _tabs: [],
                    _lastAssignedTabId: 0,

                    // Ensure |tab| has a .id property assigned, and possibly update its
                    // |visible_url| or |invisible_url| property.
                    //
                    // info is an object passed from the requesting frame, containing
                    //   visible: whether the frame is on a visible or preloading page
                    //   url: url of the frame
                    //   top_level: true if the frame is top level in its page
                    //
                    // Called by the global page.
                    notice: function(tab, info) {
                        // Clean up closed tabs, to avoid memory bloat.
                        this._tabs = this._tabs.filter(function(t) { return t.browserWindow !== null; });

                        if (tab.id === undefined) {
                            // New tab
                            tab.id = this._lastAssignedTabId + 1;
                            this._lastAssignedTabId = tab.id;
                            this._tabs.push(tab); // save so it isn't garbage collected, losing our data.
                        }

                        if (info.top_level) {
                            tab[info.visible ? "visible_url" : "invisible_url"] = new parseURI(info.url).href;
                        }
                    },

                    // Return an {id, url} object for the given tab's top level frame if
                    // visible is true, or the given tab's preloaded page's top level frame,
                    // if visible is false.  Assumes this.notice() has been called for every
                    // message from a frame to the global page.
                    //
                    // Called by the global page.
                    info: function(tab, visible) {
                        return {
                            id: tab.id,
                            url: (visible ? new parseURI(tab.visible_url).href : new parseURI(tab.invisible_url).href)
                        };
                    }
                },

                i18n: (function() {

                    function syncFetch(file, fn) {
                        var xhr = new XMLHttpRequest();
                        xhr.open("GET", chrome.runtime.getURL(file), false);
                        xhr.onreadystatechange = function() {
                            if (this.readyState === 4 && this.responseText !== "") {
                                fn(this.responseText);
                            }
                        };
                        try {
                            xhr.send();
                        }
                        catch (e) {
                            // File not found, perhaps
                        }
                    }

                    // Insert substitution args into a localized string.
                    function parseString(msgData, args) {
                        // If no substitution, just turn $$ into $ and short-circuit.
                        if (msgData.placeholders === undefined && args === undefined) {
                            return msgData.message.replace(/\$\$/g, "$");
                        }

                        // Substitute a regex while understanding that $$ should be untouched
                        function safesub(txt, re, replacement) {
                            var dollaRegex = /\$\$/g, dollaSub = "~~~I18N~~:";
                            txt = txt.replace(dollaRegex, dollaSub);
                            txt = txt.replace(re, replacement);
                            // Put back in "$$" ("$$$$" somehow escapes down to "$$")
                            var undollaRegex = /~~~I18N~~:/g, undollaSub = "$$$$";
                            txt = txt.replace(undollaRegex, undollaSub);
                            return txt;
                        }

                        var $n_re = /\$([1-9])/g;
                        function $n_subber(_, num) { return args[num - 1]; }

                        var placeholders = {};
                        // Fill in $N in placeholders
                        for (var name in msgData.placeholders) {
                            var content = msgData.placeholders[name].content;
                            placeholders[name.toLowerCase()] = safesub(content, $n_re, $n_subber);
                        }
                        // Fill in $N in message
                        var message = safesub(msgData.message, $n_re, $n_subber);
                        // Fill in $Place_Holder1$ in message
                        message = safesub(message, /\$(\w+?)\$/g, function(full, name) {
                            var lowered = name.toLowerCase();
                            if (lowered in placeholders) {
                                return placeholders[lowered];
                            }
                            return full; // e.g. '$FoO$' instead of 'foo'
                        });
                        // Replace $$ with $
                        message = message.replace(/\$\$/g, "$");

                        return message;
                    }

                    var l10nData = undefined;

                    var theI18nObject = {
                        // chrome.i18n.getMessage() may be used in any extension resource page
                        // without any preparation.  But if you want to use it from a content
                        // script in Safari, the content script must first run code like this:
                        //
                        //   get_localization_data_from_global_page_async(function(data) {
                        //     chrome.i18n._setL10nData(data);
                        //     // now I can call chrome.i18n.getMessage()
                        //   });
                        //   // I cannot call getMessage() here because the above call
                        //   // is asynchronous.
                        //
                        // The global page will need to receive your request message, call
                        // chrome.i18n._getL10nData(), and return its result.
                        //
                        // We can't avoid this, because the content script can't load
                        // l10n data for itself, because it's not allowed to make the xhr
                        // call to load the message files from disk.  Sorry :(
                        _getL10nData: function() {
                            var result = { locales: [] };

                            // === Find all locales we might need to pull messages from, in order
                            // 1: The user's current locale, converted to match the format of
                            //    the _locales directories (e.g. "en-US" becomes "en_US"
                            result.locales.push(navigator.language.replace("-", "_"));
                            // 2: Perhaps a region-agnostic version of the current locale
                            if (navigator.language.length > 2) {
                                result.locales.push(navigator.language.substring(0, 2));
                            }
                            // 3: Set English 'en' as default locale
                            if (result.locales.indexOf("en") === -1) {
                                result.locales.push("en");
                            }

                            // Load all locale files that exist in that list
                            result.messages = {};
                            for (var i = 0; i < result.locales.length; i++) {
                                var locale = result.locales[i];
                                var file = "_locales/" + locale + "/messages.json";
                                // Doesn't call the callback if file doesn't exist
                                syncFetch(file, function(text) {
                                    result.messages[locale] = JSON.parse(text);
                                });
                            }

                            return result;
                        },

                        // Manually set the localization data.  You only need to call this
                        // if using chrome.i18n.getMessage() from a content script, before
                        // the first call.  You must pass the value of _getL10nData(),
                        // which can only be called by the global page.
                        _setL10nData: function(data) {
                            l10nData = data;
                        },

                        getMessage: function(messageID, args) {
                            if (l10nData === undefined) {
                                // Assume that we're not in a content script, because content
                                // scripts are supposed to have set l10nData already
                                chrome.i18n._setL10nData(chrome.i18n._getL10nData());
                            }
                            if (typeof args === "string") {
                                args = [args];
                            }
                            for (var i = 0; i < l10nData.locales.length; i++) {
                                var map = l10nData.messages[l10nData.locales[i]];
                                // We must have the locale, and the locale must have the message
                                if (map && messageID in map) {
                                    return parseString(map[messageID], args);
                                }
                            }
                            return "";
                        }
                    };

                    return theI18nObject;
                })()

            };
            // The property id is defined here so that we can invoke it without
            // the need for parentheses
            // for example `chrome.runtime.id`
            // should return "com.betafish.adblockforsafari-UAMUU452D9"
            Object.defineProperty(chrome.runtime, "id", {
                get: function() {
                    return new parseURI(safari.extension.baseURI).hostname;
                },
                set: undefined
            });
        }

    })();
} // end if (typeof SAFARI === "undefined") { (function() {