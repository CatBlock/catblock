var BG = chrome.extension.getBackgroundPage();

// Set menu entries appropriately for the selected tab.
function customize_for_this_tab() {
  $(".menu-entry, .separator").hide();

  BG.getCurrentTabInfo(function(info) {
    var shown = {};
    function show(L) { L.forEach(function(x) { shown[x] = true;  }); }
    function hide(L) { L.forEach(function(x) { shown[x] = false; }); }

    show(["div_options", "separator2"]);
    if (BG.sessionStorage.getItem('adblock_is_paused')) {
      show(["div_status_paused", "separator0", "div_options"]);
    } else if (info.disabled_site) {
      show(["div_status_disabled", "separator0", "div_options",
            "div_help_hide_start"]);
    } else if (info.whitelisted) {
      show(["div_status_whitelisted", "div_show_resourcelist",
            "separator0", "div_pause_adblock", "separator1",
            "div_options", "div_help_hide_start"]);
    } else {
      show(["div_pause_adblock", "div_blacklist", "div_whitelist",
            "div_whitelist_page", "div_show_resourcelist",
            "div_report_an_ad", "separator1", "div_options",
            "div_help_hide_start", "separator3"]);
    }
    if (!BG.get_settings().show_advanced_options)
      hide(["separator3", "div_show_resourcelist", "div_report_an_ad"]);

    for (var div in shown)
      if (shown[div])
        $('#' + div).show();
  });
}

// Click handlers
$(function() {

  $("#div_status_whitelisted a").click(function() {
    BG.getCurrentTabInfo(function(info) {
      if (BG.try_to_unwhitelist(info.tab.url)) {
        // Reload the tab
        chrome.tabs.update(info.tab.id, {url: info.tab.url});
        window.close();
      } else {
        $("#div_status_whitelisted").
        replaceWith(translate("disabled_by_filter_lists"));
      }
    });
  });

  $("#div_status_paused a").click(function() {
    BG.sessionStorage.removeItem('adblock_is_paused');
    BG.handlerBehaviorChanged();
    BG.updateButtonUIAndContextMenus();
    window.close();
  });

  $("#div_pause_adblock").click(function() {
    BG.sessionStorage.setItem('adblock_is_paused', true);
    BG.updateButtonUIAndContextMenus();
    chrome.contextMenus.removeAll();
    window.close();
  });

  $("#div_blacklist").click(function() {
    BG.getCurrentTabInfo(function(info) {
      BG.emit_page_broadcast(
        {fn:'top_open_blacklist_ui', options: { nothing_clicked: true }},
        { tab: info.tab } // fake sender to determine target page
      );
      window.close();
    });
  });

  $("#div_whitelist_page").click(function() {
    BG.getCurrentTabInfo(function(info) {
      BG.create_page_whitelist_filter(info.tab.url);
      // Reload the tab
      chrome.tabs.update(info.tab.id, {url: info.tab.url});
      window.close();
    });
  });

  $("#div_whitelist").click(function() {
    BG.getCurrentTabInfo(function(info) {
      BG.emit_page_broadcast(
        {fn:'top_open_whitelist_ui', options:{}},
        { tab: info.tab } // fake sender to determine target page
      );
      window.close();
    });
  });

  $("#div_show_resourcelist").click(function() {
    BG.getCurrentTabInfo(function(info) {
      BG.launch_resourceblocker(info.tab.id);
    });
  });

  $("#div_report_an_ad").click(function() {
    BG.getCurrentTabInfo(function(info) {
      var url = "pages/adreport.html?url=" + escape(info.tab.url);
      BG.openTab(url, true);
    });
  });

  $("#div_options").click(function() {
    BG.openTab("options/index.html");
  });

  $("#div_help_hide").click(function() {
    $("#help_hide_explanation").slideDown();
  });
});

$(function() {
  customize_for_this_tab();
  localizePage();
});
