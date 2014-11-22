  // OPTIONAL SETTINGS

  function Settings() {
    var defaults = {
      debug_logging: false,
      show_google_search_text_ads: false,
      show_context_menu_items: true,
      show_advanced_options: false,
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
      if (!nearActive) {
        chrome.tabs.create({url: url});
      } else {
        chrome.windows.getCurrent(function(currentWindow) {
          chrome.tabs.query({active: true, windowId: currentWindow.id}, function(tabs) {
            chrome.tabs.create({ url: url, index: (tabs[0] ? tabs[0].index + 1 : undefined) });
          });
        });
      }
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

  // Implement blocking via the Chrome webRequest API.
  if (!SAFARI) {
    // Stores url, whitelisting, and blocking info for a tabid+frameid
    // TODO: can we avoid making this a global once 'old' style dies?
    frameData = {
      // Return the data object for |tabId| and |frameId|, or
      // undefined if |tabId| and |frameId| are not being tracked.
      get: function(tabId, frameId) {
        return (frameData[tabId] || {})[frameId];
      },

      // Record that |tabId|, |frameId| points to |url|.
      record: function(tabId, frameId, url) {
        var fd = frameData;
        if (!fd[tabId]) fd[tabId] = {};
        fd[tabId][frameId] = {
          url: url,
          // Cache these as they'll be needed once per request
          domain: parseUri(url).hostname
        };
        if (frameId === 0) {
          fd[tabId][frameId].whitelisted = page_is_whitelisted(url);
          fd[tabId][frameId].resources = {};
        }
      },

      // Watch for requests for new tabs and frames, and track their URLs.
      // Inputs: details: object from onBeforeRequest callback
      // Returns false if this request's tab+frame are not trackable.
      track: function(details) {
        var fd = frameData, tabId = details.tabId;

        if (tabId == -1) // A hosted app's background page
          return false;

        if (details.type == 'main_frame') { // New tab
          delete fd[tabId];
          fd.record(tabId, 0, details.url);
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
        var potentialEmptyFrameId = (details.type == 'sub_frame' ? details.parentFrameId: details.frameId);
        if (undefined === fd.get(tabId, potentialEmptyFrameId)) {
          fd.record(tabId, potentialEmptyFrameId, fd.get(tabId, 0).url);
          log("[DEBUG]", "Null frame", tabId, potentialEmptyFrameId, "found; giving it the tab's URL.");
        }

        if (details.type == 'sub_frame') { // New frame
          fd.record(tabId, details.frameId, details.url);
          log("[DEBUG]", "=========== Tracking frame", tabId, details.parentFrameId, details.frameId, details.url);
        }

        return true;
      },

      // Record a resource for the resource blocker.
      storeResource: function(tabId, url, elType) {
        if (!get_settings().show_advanced_options)
          return;
        var data = frameData.get(tabId, 0);
        if (data !== undefined)
          data.resources[elType + ':|:' + url] = null;
      },

      // When a tab is closed, delete all its data
      onTabClosedHandler: function(tabId) {
        log("[DEBUG]", "----------- Closing tab", tabId);
        delete frameData[tabId];
      }
    };

    // When a request starts, perhaps block it.
    function onBeforeRequestHandler(details) {
      if (sessionStorage.adblock_is_paused)
        return { cancel: false };

      if (!frameData.track(details))
        return { cancel: false };

      var tabId = details.tabId;
      var elType = ElementTypes.fromOnBeforeRequestType(details.type);

      frameData.storeResource(tabId, details.url, elType);

      if (frameData.get(tabId, 0).whitelisted) {
        log("[DEBUG]", "Ignoring whitelisted tab", tabId, details.url.substring(0, 100));
        return { cancel: false };
      }

      // For most requests, Chrome and we agree on who sent the request: the frame.
      // But for iframe loads, we consider the request to be sent by the outer
      // frame, while Chrome claims it's sent by the new iframe.  Adjust accordingly.
      var requestingFrameId = (details.type == 'sub_frame' ? details.parentFrameId : details.frameId);
      // May the URL be loaded by the requesting frame?
      var frameDomain = frameData.get(tabId, requestingFrameId).domain;
      var blocked = _myfilters.blocking.matches(details.url, elType, frameDomain);

      var canPurge = (elType & (ElementTypes.image | ElementTypes.subdocument | ElementTypes.object));
      if (canPurge && blocked) {
        // frameUrl is used by the recipient to determine whether they're the frame who should
        // receive this or not.  Because the #anchor of a page can change without navigating
        // the frame, ignore the anchor when matching.
        var frameUrl = frameData.get(tabId, requestingFrameId).url.replace(/#.*$/, "");
        var data = { command: "purge-elements", tabId: tabId, frameUrl: frameUrl, url:details.url, elType: elType };
        chrome.tabs.sendRequest(tabId, data);
      }

      log("[DEBUG]", "Block result", blocked, details.type, frameDomain, details.url.substring(0, 100));
      if (blocked && elType === ElementTypes.subdocument)
        return { redirectUrl: "about:blank" };
      else
        return { cancel: blocked };
    }

    // Popup blocking
    function onCreatedNavigationTargetHandler(details) {
      var opener = frameData.get(details.sourceTabId, details.sourceFrameId);
      if (opener === undefined)
        return;
      var match = _myfilters.blocking.matches(details.url, ElementTypes.popup, opener.domain);
      if (match)
        chrome.tabs.remove(details.tabId);
      frameData.storeResource(details.sourceTabId, details.url, ElementTypes.popup);
    };
  }

  debug_report_elemhide = function(selector, matches, sender) {
    if (!window.frameData)
      return;
    frameData.storeResource(sender.tab.id, selector, "HIDE");
    var data = frameData.get(sender.tab.id, 0);
    if (data)
      log(data.domain, ": hiding rule", selector, "matched:\n", matches);
  }

  // UNWHITELISTING

  // Look for a custom filter that would whitelist options.url,
  // and if any exist, remove the first one.
  // Inputs: url:string - a URL that may be whitelisted by a custom filter
  // Returns: true if a filter was found and removed; false otherwise.
  try_to_unwhitelist = function(url) {
    url = url.replace(/#.*$/, ''); // Whitelist ignores anchors
    var loweredUrl = url.toLowerCase();
    var custom_filters = get_custom_filters_text().split('\n');
    for (var i = 0; i < custom_filters.length; i++) {
      var text = custom_filters[i];
      if (!Filter.isWhitelistFilter(text))
        continue;
      var filter = PatternFilter.fromText(text);
      if (!filter.matches(url, loweredUrl, ElementTypes.document, false))
        continue;

      custom_filters.splice(i, 1); // Remove this whitelist filter text
      var new_text = custom_filters.join('\n');
      set_custom_filters_text(new_text);
      return true;
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
    _myfilters.rebuild();
  }

  // Removes a custom filter entry.
  // Inputs: filter:string line of text to remove from custom filters.
  remove_custom_filter = function(filter) {
    // Make sure every filter is preceded and followed by at least one \n,
    // then find and remove the filter.
    var text = "\n" + get_custom_filters_text() + "\n";
    text = text.replace("\n" + filter + "\n", "\n");
    set_custom_filters_text(text.trim());
  }

  get_settings = function() {
    return _settings.get_all();
  }

  set_setting = function(name, is_enabled) {
    _settings.set(name, is_enabled);

    if (name == "debug_logging") {
      if (is_enabled)
        log = function() {
          if (VERBOSE_DEBUG || arguments[0] != '[DEBUG]')
            console.log.apply(console, arguments);
        };
      else
        log = function() { };
    }
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
        if (attr == "text") continue;
        result[id][attr] = _myfilters._subscriptions[id][attr];
      }
    }
    return result;
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
      requiresList: options.requires
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

  // Returns true if the url cannot be blocked
  page_is_unblockable = function(url) {
    if (!url) { // Safari empty/bookmarks/top sites page
      return true;
    } else {
      var scheme = parseUri(url).protocol;
      return (scheme !== 'http:' && scheme !== 'https:' && scheme !== 'feed:');
    }
  }

  // INFO ABOUT CURRENT PAGE

  // Get interesting information about the current tab.
  // Inputs:
  //   callback: function(info).
  //   info object passed to callback: {
  //     tab: Tab object
  //     whitelisted: bool - whether the current tab's URL is whitelisted.
  //     domain: string
  //     disabled_site: bool - true if the url is e.g. about:blank or the
  //                           Extension Gallery, where extensions don't run.
  //   }
  // Returns: null (asynchronous)
  getCurrentTabInfo = function(callback) {
    chrome.tabs.getSelected(undefined, function(tab) {
      var disabled_site = page_is_unblockable(tab.url);

      var result = {
        tab: tab,
        disabled_site: disabled_site,
        domain: parseUri(tab.url).hostname,
      };
      if (!disabled_site)
        result.whitelisted = page_is_whitelisted(tab.url);

      callback(result);
    });
  }

  // Returns true if anything in whitelist matches the_domain.
  //   url: the url of the page
  //   type: one out of ElementTypes, default ElementTypes.document,
  //         to check what the page is whitelisted for: hiding rules or everything
  //   returnFilter: if the filter that whitelisted the page should be returned
  page_is_whitelisted = function(url, type, returnFilter) {
    if (!url) { // Safari empty/bookmarks/top sites page
      return true;
    }
    url = url.replace(/\#.*$/, ''); // Remove anchors
    var loweredUrl = url.toLowerCase();
    if (!type)
      type = ElementTypes.document;
    var whitelist = _myfilters.blocking.whitelist;
    var match = whitelist.matches(url, loweredUrl, type, parseUri(url).hostname, false);
    if (match)
      return returnFilter ? match._text : true;
    return false;
  }

  if (!SAFARI) {

    // Set popup for Chrome/Opera
    chrome.browserAction.setPopup({popup: "button/popup.html"});

    // Set the button image and context menus according to the URL
    // of the current tab.
    updateButtonUIAndContextMenus = function() {

      function setContextMenus(info) {
        chrome.contextMenus.removeAll();
        if (!get_settings().show_context_menu_items)
          return;

        if (sessionStorage.adblock_is_paused || info.whitelisted || info.disabled_site)
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
      }

      function setBrowserButton(info) {
        if (sessionStorage.adblock_is_paused) {
          chrome.browserAction.setIcon({path:"img/icon19-grayscale.png", tabId: info.tab.id});
        } else if (info.disabled_site &&
            !/^chrome-extension:.*pages\/install\//.test(info.tab.url)) {
          // Show non-disabled icon on the installation-success page so it
          // users see how it will normally look. All other disabled pages
          // will have the gray one
          chrome.browserAction.setIcon({path:"img/icon19-grayscale.png", tabId: info.tab.id});
        } else if (info.whitelisted) {
          chrome.browserAction.setIcon({path:"img/icon19-whitelisted.png", tabId: info.tab.id});
        } else {
          chrome.browserAction.setIcon({path:"img/icon19.png", tabId: info.tab.id});
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
        custom_filters = custom_filters + '\n' + filter;
        set_custom_filters_text(custom_filters);
        return null;
      }
      return "This filter is unsupported";
    } catch(ex) {
      return ex;
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

  // TODO: make better.
  // Inputs: options object containing:
  //           domain:string the domain of the calling frame.
  //           include_texts?:bool true if PatternFilter._text should be
  //                               appended to block filters.
  get_content_script_data = function(options, sender) {
    var whitelisted = page_is_whitelisted(sender.tab.url);
    var settings = get_settings();
    var result = {
      page_is_whitelisted: whitelisted,
      adblock_is_paused: sessionStorage.getItem('adblock_is_paused'),
      settings: settings,
      selectors: []
    };
    if (whitelisted || result.adblock_is_paused)
      return result;

    // Not whitelisted, and running on adblock_start.  We have two tasks:
    // apply CSS-hiding rules, and send Chrome a filterset.

    if (!page_is_whitelisted(sender.tab.url, ElementTypes.elemhide)) {
      result.selectors = _myfilters.hiding.
        filtersFor(options.domain, function(f) { return f.selector; });
    }
    // TODO this sucks.  and stop packing, since we can be slow on resourceblock.html.
    if (!SAFARI && options.include_texts) {
      var packed = function(filter) {
        return [filter._rule.source, filter._allowedElementTypes, filter._options, filter._text];
      }
      result.patternSerialized = _myfilters.blocking.pattern.
        filtersFor(options.domain, packed);
      result.whitelistSerialized = _myfilters.blocking.whitelist.
        filtersFor(options.domain, packed);
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
            "jquery/jquery.min.js",
            "jquery/jquery-ui.custom.min.js",
            "uiscripts/load_jquery_ui.js",
            "uiscripts/top_open_whitelist_ui.js"
            ]
        },
        'top_open_blacklist_ui': {
          allFrames: false,
          include: [
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
            "jquery/jquery.min.js",
            // we must get jQuery into every frame, but that clobbers
            // jquery UI installed by top_open_blacklist_ui but not
            // needed by us.  Reinstall on top_open_blacklist_ui's behalf.
            "jquery/jquery-ui.custom.min.js",
            "uiscripts/blacklisting/send_content_to_back.js"
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

  // Open the resource blocker when requested from the Chrome popup.
  launch_resourceblocker = function(tabId) {
    var data = frameData.get(tabId, 0);
    if (!data)
      return;
    openTab("pages/resourceblock.html?tabId=" + tabId + "&url=" + escape(data.url), true);
  }

  // Return chrome.i18n._getL10nData() for content scripts who cannot
  // call that function (since it loads extension files from disk.)
  // Only defined in Safari.
  get_l10n_data = (SAFARI ? chrome.i18n._getL10nData : undefined);


  // BGcall DISPATCH
  (function() {
  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      if (request.command != "call")
        return; // not for us

      var target = window;
      var parts = request.fn.split('.');
      for (var i=0; i < parts.length-1; i++) {
        target = target[parts[i]];
      }
      var fnName = parts[parts.length-1];
      var fn = target[fnName];
      request.args.push(sender);
      var result = fn.apply(target, request.args);
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
        if (tab.selected && changeInfo.status === "loading")
          updateButtonUIAndContextMenus();
      });
      chrome.tabs.onSelectionChanged.addListener(function(tabid, selectInfo) {
        updateButtonUIAndContextMenus();
      });
    }
  })();

  if (get_settings().debug_logging)
    log = function() {
      if (VERBOSE_DEBUG || arguments[0] != '[DEBUG]') // comment out for verbosity
        console.log.apply(console, arguments);
    };

  _myfilters = new MyFilters();

  if (!SAFARI) {
    // Chrome blocking code.  Near the end so synchronous request handler
    // doesn't hang Chrome while AdBlock initializes.
    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequestHandler, {urls: ["http://*/*", "https://*/*"]}, ["blocking"]);
    chrome.tabs.onRemoved.addListener(frameData.onTabClosedHandler);
    // Popup blocking
    chrome.webNavigation.onCreatedNavigationTarget.addListener(onCreatedNavigationTargetHandler);
  }

  if (SAFARI) {
    $.getScript("safari_bg.js");
  }

  if (!SAFARI) {
      // Listens for message from CatBlock content script asking to load jQuery.
      chrome.extension.onRequest.addListener(
          function(request, sender, sendResponse) {
              if (request.command === "inject_jquery") {
                  chrome.tabs.executeScript(undefined,
                      { allFrames: request.allFrames, file: "../jquery/jquery.min.js" },
                      function() { sendResponse({});
                  });
              }
          }
      );
  }

  channels = new Channels();

  log("\n===FINISHED LOADING===\n\n");
