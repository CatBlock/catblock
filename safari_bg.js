emit_page_broadcast = (function() {
  // Private list of connected ports for emit_page_broadcast()
  var broadcast_ports = [];
  chrome.extension.onConnect.addListener(function(port) {
    port.onDisconnect.addListener(function(disconnected_port) {
      var where = broadcast_ports.indexOf(disconnected_port);
      if (where != -1) {
        broadcast_ports.splice(where, 1);
      }
    });
    broadcast_ports.push(port);
  });

  // The emit_page_broadcast() function
  var theFunction = function(request, sender) {
    $.each(broadcast_ports, function(i, port) {
        // issue 5416, fixed in Chrome and probably never happens in
        // Safari: port.sender.tab could be null for an unknown reason.
        if (!port.sender.tab)
          return;
      if (port.sender.tab.id == sender.tab.id)
        port.postMessage(request);
    });
  };
  return theFunction;
})();

function adblockIsPaused() {
  return sessionStorage.getItem('adblock_is_paused');
}

// True blocking support.
safari.application.addEventListener("message", function(messageEvent) {
  if (messageEvent.name != "canLoad")
    return;

  if (adblockIsPaused() || page_is_whitelisted(messageEvent.target.url)) {
    messageEvent.message = true;
    return;
  }

  var url = messageEvent.message.url;
  var elType = messageEvent.message.elType;
  var frameDomain = messageEvent.message.frameDomain;

  var isMatched = url && (_myfilters.blocking.matches(url, elType, frameDomain));
  if (isMatched)
    log("SAFARI TRUE BLOCK " + url + ": " + isMatched);
  messageEvent.message = !isMatched;
}, false);

// Allows us to figure out the window for commands sent from the menu. Not used in Safari 5.0.
var windowByMenuId = {};

safari.application.addEventListener("command", function(event) {
  // It is possible to do perform a command without activating a window
  // (at least on Mac). That means we can't blindly perform actions in activeWindow,
  // otherwise users would be very confused. So let's figure out which window sent the command.

  var browserWindow;
  if (event.target.browserWindow) {
    // Context menu item event or button event on Safari 5.0, browserWindow is available in event.target.
    browserWindow = event.target.browserWindow;
  } else if (event.target instanceof SafariExtensionMenuItem) {
    // Identifier will be of the form menuId:command, let's use this to get our window
    var menuId = event.target.identifier.split(':')[0];
    browserWindow = windowByMenuId[menuId];
  } else {
    // browserWindow is not available in event.target for context menu item events in Safari 5.1.
    browserWindow = safari.application.activeBrowserWindow;
  }
  var command = event.command;

  if (command === "AdBlockOptions") {
    openTab("options/index.html", false, browserWindow);
  } else if (command === "toggle-pause") {
    if (adblockIsPaused()) {
      sessionStorage.removeItem('adblock_is_paused');
    } else {
      sessionStorage.setItem('adblock_is_paused', true);
    }
  } else if (command === "whitelist-currentpage") {
    var tab = browserWindow.activeTab;
    create_page_whitelist_filter(tab.url);
    tab.url = tab.url;
  } else if (command === "unwhitelist-currentpage") {
    var tab = browserWindow.activeTab;
    var unwhitelisted = false;
    while (try_to_unwhitelist(tab.url)) {
      unwhitelisted = true;
    }
    if (unwhitelisted) {
      tab.url = tab.url;
    }
  } else if (command === "report-ad") {
    var url = "pages/adreport.html?url=" + escape(browserWindow.activeTab.url);
    openTab(url, true, browserWindow);
  } else if (command in {"show-whitelist-wizard": 1, "show-blacklist-wizard": 1, "show-clickwatcher-ui": 1 }) {
    browserWindow.activeTab.page.dispatchMessage(command);
  }
}, false);

// Starting with 5.1, we can attach menus to toolbar items. If safari.extension.createMenu is available,
// we can make the toolbar button display a proper menu with items from Chrome's popup.
if (!LEGACY_SAFARI) {
  (function() {
    // Unfortunately, Safari API kinda sucks. Command events sent from toolbar menu items don't include a
    // reference to the browser window that sent them, same goes for the Menu events. This unfortunately
    // means that we have to create a separate instance of menu for each browser window.

    // Menu identifiers must be unique, we'll just name them sequentially.
    var nextMenuId = (function() {
      var counter = 0;
      return function() {
        var id = counter++;
        return "ABMainMenu_" + id;
      }
    })();

    function createMenu(toolbarItem) {
      var menu = safari.extension.createMenu(nextMenuId());

      windowByMenuId[menu.identifier] = toolbarItem.browserWindow;

      // Attach the menu to the toolbar item
      toolbarItem.menu = menu;
      toolbarItem.toolTip = "AdBlock"; // change the tooltop on Safari 5.1+
      toolbarItem.command = null; // otherwise Safari will only show the menu on long-press
    }

    function removeMenu(menu) {
      delete windowByMenuId[menu.identifier];
      safari.extension.removeMenu(menu.identifier);
    }

    safari.application.addEventListener("validate", function(event) {
      if (event.target instanceof SafariExtensionToolbarItem) {
        var item = event.target;

        if (item.browserWindow && !item.menu) {
          // Check if only this item lacks a menu (which means user just opened a new window) or there are multiple items
          // lacking a menu (which only happens on browser startup or when the user removes AdBlock toolbar item and later
          // drags it back).
          var uninitializedItems = 0;
          for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
            var item = safari.extension.toolbarItems[i];
            if (!item.menu) {
              uninitializedItems++;
            }
          }

          if (uninitializedItems > 1) {
            // Browser startup or toolbar item added back to the toolbar. To prevent memory leaks in the second case,
            // we need to remove all previously created menus and window mappings (as they are now invalid).
            var menus = safari.extension.menus;
            for (var i = 0; i < menus.length; i++) {
              removeMenu(menus[i]);
            }

            // And now recreate the menus for toolbar items in all windows.
            for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
              createMenu(safari.extension.toolbarItems[i]);
            }
          } else {
            // New window opened, just create a menu for this window's item.
            createMenu(item);
          }
        }
      }
    }, true);

    // Remove the menu when the window closes so we don't leak memory.
    safari.application.addEventListener("close", function(event) {
      if (event.target instanceof SafariBrowserWindow) { // don't handle tabs
        for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
          var item = safari.extension.toolbarItems[i];
          if (item.browserWindow === event.target) {
            var menu = item.menu;

            // Safari docs say that we must detach menu from toolbar items before removing.
            item.menu = null;

            // Remove the menu and window mapping.
            removeMenu(menu);
            break;
          }
        }
      }
    }, true);

    // As there is no API to toggle visibility of toolbar items, we'd have to dynamically append and remove
    // them when something changes. Instead, let's just cheat and recreate the whole menu when the user
    // tries to open it.
    safari.application.addEventListener("menu", function(event) {
      var menu = event.target;

      if (menu.identifier.indexOf("ABMainMenu_") === 0) {
        while (menu.menuItems.length > 0) {
          menu.removeMenuItem(0);
        }

        // Menu item identifiers must be unique and we need some way to figure out the
        // window by menu item, so let's prefix them with menu ID.
        function itemIdentifier(identifier) {
          return menu.identifier + ':' + identifier;
        }
        function appendMenuItem(command, title, checked) {
          var item = menu.appendMenuItem(itemIdentifier(command), title, command);
          if (checked) {
            item.checkedState = SafariExtensionMenuItem.CHECKED;
          }
        }

        var url = windowByMenuId[menu.identifier].activeTab.url;
        var paused = adblockIsPaused();
        var canBlock = !page_is_unblockable(url);
        var whitelisted = page_is_whitelisted(url);

        appendMenuItem("toggle-pause", translate("pause_adblock"), paused);
        if (!paused && canBlock) {
          if (whitelisted) {
            // Show one checked "Don't run on this page" item that would un-whitelist the page.
            // That doesn't correspond one-to-one with whitelisting items (there are two of them,
            // one that whitelists specific page and one that whitelists the domain), but this doesn't
            // require changing anything in translations and works nice anyway.
            appendMenuItem("unwhitelist-currentpage", translate("dont_run_on_this_page"), true);
          } else {
            appendMenuItem("show-clickwatcher-ui", translate("block_an_ad_on_this_page"));
            appendMenuItem("whitelist-currentpage", translate("dont_run_on_this_page"));
            appendMenuItem("show-whitelist-wizard", translate("dont_run_on_pages_on_domain"));
          }
        }
        menu.appendSeparator(itemIdentifier("separator"));
        if (!paused && canBlock && !whitelisted && get_settings().show_advanced_options) {
          appendMenuItem("report-ad", translate("report_ad_on_page"));
        }
        appendMenuItem("AdBlockOptions", translate("options"));
      }
    })
  })();
}

// Open Options page upon settings checkbox click.
safari.extension.settings.openAdBlockOptions = false;
safari.extension.settings.addEventListener("change", function(e) {
  if (e.key == 'openAdBlockOptions')
    openTab("options/index.html");
}, false);

// Add context menus
safari.application.addEventListener("contextmenu", function(event) {
  if (!event.userInfo)
    return;
  if (!get_settings().show_context_menu_items || adblockIsPaused())
    return;

  var url = event.target.url;
  if (!page_is_unblockable(url) && !page_is_whitelisted(url)) {
    event.contextMenu.appendContextMenuItem("show-blacklist-wizard", translate("block_this_ad"));
    event.contextMenu.appendContextMenuItem("show-clickwatcher-ui", translate("block_an_ad_on_this_page"));
  }
}, false);
