//the tab object, which contains |id| and |url| (stored as unicodeUrl) of the current tab
var tab = null;

$(function() {
    localizePage();

    var BG = chrome.extension.getBackgroundPage();

    // Set menu entries appropriately for the selected tab.
    $(".menu-entry, .menu-status, .separator").hide();

    BG.getCurrentTabInfo(function(info) {
        // Cache tab object for later use
        tab = info.tab;
        var shown = {};
        function show(L) { L.forEach(function(x) { shown[x] = true;  }); }
        function hide(L) { L.forEach(function(x) { shown[x] = false; }); }

        show(["div_options", "separator2"]);
        var paused = BG.adblock_is_paused();
        if (paused) {
            show(["div_status_paused", "separator0","div_paused_adblock", "div_options"]);
        } else if (info.disabled_site) {
            show(["div_status_disabled", "separator0", "div_pause_adblock",
                  "div_options", "div_help_hide_start"]);
        } else if (info.whitelisted) {
            show(["div_status_whitelisted","div_enable_adblock_on_this_page",
                  "separator0", "div_pause_adblock", "separator1", "div_show_resourcelist",
                  "div_options", "div_help_hide_start"]);
        } else {
            show(["div_pause_adblock", "div_blacklist", "div_whitelist",
                  "div_whitelist_page", "div_show_resourcelist",
                  "div_report_an_ad", "separator1", "div_options",
                  "div_help_hide_start", "separator3", "block_counts"]);

            var page_count = info.tab_blocked || "0";
            $("#page_blocked_count").text(page_count);
            $("#total_blocked_count").text(info.total_blocked);

            // Show help link until it is clicked.
            $("#block_counts_help").
            toggle(BG.get_settings().show_block_counts_help_link).
            click(function() {
                BG.set_setting("show_block_counts_help_link", false);
                BG.openTab($(this).attr("href"));
                $(this).hide();
                closeAndReloadPopup();
            });
        }

        var host = parseUri(tab.unicodeUrl).host;
        var advanced_option = BG.get_settings().show_advanced_options;
        var eligible_for_undo = !paused && (info.disabled_site || !info.whitelisted);
        var url_to_check_for_undo = info.disabled_site ? undefined : host;
        if (eligible_for_undo &&
            BG.count_cache.getCustomFilterCount(url_to_check_for_undo) &&
            !LEGACY_SAFARI_51)
            show(["div_undo", "separator0"]);

        if (SAFARI || !advanced_option || !tab.id)
            hide(["div_show_resourcelist"]);

        if ((SAFARI && !advanced_option) || !tab.id)
            hide(["div_report_an_ad", "separator1"]);

        if (host === "www.youtube.com" &&
            /channel|user/.test(tab.unicodeUrl) &&
            /ab_channel/.test(tab.unicodeUrl) &&
            eligible_for_undo &&
            BG.get_settings().youtube_channel_whitelist) {
            $("#div_whitelist_channel").html(translate("whitelist_youtube_channel",
                                                       parseUri.parseSearch(tab.unicodeUrl).ab_channel));
            show(["div_whitelist_channel"]);
        }

        // In Safari with content blocking enabled,
        // whitelisting of domains is not currently supported.
        if (SAFARI &&
            BG.get_settings().safari_content_blocking) {
            hide(["div_paused_adblock", "div_whitelist_page", "div_whitelist"]);
        }


        for (var div in shown)
            if (shown[div])
                $('#' + div).show();

        if (SAFARI ||
            !info.display_menu_stats ||
            paused ||
            info.disabled_site ||
            info.whitelisted) {
            $("#block_counts").hide();
        }

        if (EDGE) {
            $("#div_help_hide_start").hide();
            if (storage_get("update_available")) {
                $("#update").show();
            }
        }

    });

    if (SAFARI) {
        // Update the width and height of popover in Safari
        $(window).load(function() {
            var popupheight = $("body").outerHeight();
            safari.extension.popovers[0].height = popupheight + 5;
            safari.extension.popovers[0].width = 270;
        });

        // Store info about active tab
        var activeTab = safari.application.activeBrowserWindow.activeTab;
    }

    // We need to reload popover in Safari, so that we could
    // update popover according to the status of AdBlock.
    // We don't need to reload popup in Chrome,
    // because Chrome reloads every time the popup for us.
    function closeAndReloadPopup() {
        if (SAFARI) {
            safari.self.hide();
            setTimeout(function() {
                window.location.reload();
            }, 200);
        } else {
            window.close();
        }
    }

    // Click handlers
    $("#titletext").click(function() {
        var url = "https://github.com/CatBlock/catblock";
        BG.openTab(chrome_url);
        closeAndReloadPopup();
    });

    $("#div_enable_adblock_on_this_page").click(function() {
        if (BG.try_to_unwhitelist(tab.unicodeUrl)) {
            if (!SAFARI) {
                chrome.tabs.update(tab.id, {url: tab.url});
            } else {
                activeTab.url = activeTab.url
            }
        } else {
            $("#div_status_whitelisted").
            replaceWith(translate("disabled_by_filter_lists"));
        }
        if (EDGE) {
            document.location.reload();
        }
        closeAndReloadPopup();
    });

    $("#div_paused_adblock").click(function() {
        BG.adblock_is_paused(false);
        BG.handlerBehaviorChanged();
        if (!SAFARI) {
            BG.updateButtonUIAndContextMenus();
        }
        if (EDGE) {
            document.location.reload();
        }
        closeAndReloadPopup();
    });

    $("#div_undo").click(function() {
        var host = parseUri(tab.unicodeUrl).host;
        BG.confirm_removal_of_custom_filters_on_host(host, activeTab);
        closeAndReloadPopup();
    });

    $("#div_whitelist_channel").click(function() {
        BG.create_whitelist_filter_for_youtube_channel(tab.unicodeUrl);
        if (!SAFARI) {
            chrome.tabs.update(tab.id, {url: tab.url});
        } else {
            activeTab.url = activeTab.url
        }
        if (EDGE) {
            document.location.reload();
        }
        closeAndReloadPopup();
    });

    $("#div_pause_adblock").click(function() {
        if (BG.get_settings().safari_content_blocking) {
            alert(translate('safaricontentblockingpausemessage'));
        } else {
            BG.adblock_is_paused(true);
            if (!SAFARI) {
                BG.updateButtonUIAndContextMenus();
            }
        }
        if (EDGE) {
            document.location.reload();
        }
        closeAndReloadPopup();
    });

    $("#div_blacklist").click(function() {
        if (!SAFARI) {
            BG.emit_page_broadcast(
                {fn:'top_open_blacklist_ui', options: { nothing_clicked: true }},
                { tab: tab } // fake sender to determine target page
            );
        } else {
            BG.dispatchMessage("show-blacklist-wizard");
        }
        closeAndReloadPopup();
    });

    $("#div_whitelist").click(function() {
        if (!SAFARI) {
            BG.emit_page_broadcast(
                {fn:'top_open_whitelist_ui', options:{}},
                { tab: tab } // fake sender to determine target page
            );
        } else {
            BG.dispatchMessage("show-whitelist-wizard");
        }
        closeAndReloadPopup();
    });

    $("#div_whitelist_page").click(function() {
        BG.create_page_whitelist_filter(tab.unicodeUrl);
        closeAndReloadPopup();
        if (!SAFARI) {
            chrome.tabs.update(tab.id, {url: tab.url});
        } else {
            activeTab.url = activeTab.url
        }
        if (EDGE) {
            document.location.reload();
        }
    });

    $("#div_show_resourcelist").click(function() {
        BG.launch_resourceblocker("?tabId=" + tab.id);
        closeAndReloadPopup();
    });

    $("#div_report_an_ad").click(function() {
        var url = "pages/adreport.html?url=" + encodeURIComponent(tab.unicodeUrl)
        + "&tabId=" + tab.id;
        BG.openTab(url, true);
        closeAndReloadPopup();
    });

    $("#div_options").click(function() {
        BG.openTab("options/index.html");
        closeAndReloadPopup();
    });

    $("#div_help_hide").click(function() {
        if (OPERA) {
            $("#help_hide_explanation").text(translate("operabutton_how_to_hide2")).slideToggle();
        } else if (SAFARI) {
            $("#help_hide_explanation").text(translate("safaributton_how_to_hide2")).
            slideToggle(function() {
                var popupheight = $("body").outerHeight();
                safari.extension.popovers[0].height = popupheight;
            });
        } else {
            $("#help_hide_explanation").slideToggle();
        }
    });
});
