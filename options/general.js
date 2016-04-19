// Check or uncheck each loaded DOM option checkbox according to the
// user's saved settings.
$(function() {

    for (var name in optionalSettings) {
        $("#enable_" + name).
        prop("checked", optionalSettings[name]);
    }
    //uncheck any incompatible options with the new safari content blocking, and then hide them
    if (optionalSettings["safari_content_blocking"]) {
        $(".exclude_safari_content_blocking > input").each(function(index) {
            $(this).prop("checked", false);
        });
        $(".exclude_safari_content_blocking").hide();
    }

    $("input.feature[type='checkbox']").change(function() {
        var is_enabled = $(this).is(':checked');
        var name = this.id.substring(7); // TODO: hack
        BGcall("set_setting", name, is_enabled, true);
        // Rebuild filters, so matched filter text is returned
        // when using resource viewer page
        if (name === "show_advanced_options") {
            BGcall("update_filters");
        }
        BGcall("get_settings", function(settings) {
            optionalSettings = settings;
        });

        if (name === "safari_content_blocking") {
            if (is_enabled) {
                $(".exclude_safari_content_blocking").hide();
                $("#safari_content_blocking_bmessage").text("");
                // message to users on the Custom tab
                $("#safariwarning").text(translate("contentblockingwarning")).show();
                // uncheck any incompatable options, and then hide them
                $(".exclude_safari_content_blocking > input").each(function(index) {
                    $(this).prop("checked", false);
                });
            } else {
                $(".exclude_safari_content_blocking").show();
                $("#safari_content_blocking_bmessage").text(translate("browserestartrequired")).show();
                // message to users on the Custom tab
                $("#safariwarning").text("").hide();
            }
            BGcall("set_content_scripts");
            BGcall("update_subscriptions_now");
        }
    }); // end of change handler

    //if safari content blocking is available...
    //  - display option to user
    //  - check if any messages need to be displayed
    //  - add a listener to process any messages
    BGcall("isSafariContentBlockingAvailable", function(response) {
        if (response) {
            $("#safari_content_blocking").show();
            getSafariContentBlockingMessage();
            //once the filters have been updated see if there's an update to the message.
            chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
                if (request.command !== "contentblockingmessageupdated")
                    return;
                getSafariContentBlockingMessage();
                sendResponse({});
            });
        }
    });

    BGcall("get_settings", function(settings) {
        if (settings.show_advanced_options &&
            !SAFARI &&
            chrome &&
            chrome.runtime &&
            chrome.runtime.onMessage) {
            $("#dropbox").show();
        } else {
            $("#dropbox").hide();
        }
    });

    update_db_icon();
    getDropboxMessage();
});

$("#enable_show_advanced_options").change(function() {
    // Reload the page to show or hide the advanced options on the
    // options page -- after a moment so we have time to save the option.
    // Also, disable all advanced options, so that non-advanced users will
    // not end up with debug/beta/test options enabled.
    if (!this.checked)
        $(".advanced input[type='checkbox']:checked").each(function() {
            BGcall("set_setting", this.id.substr(7), false);
        });
    window.setTimeout(function() {
        window.location.reload();
    }, 50);
});


function getSafariContentBlockingMessage() {
    BGcall('sessionstorage_get', 'contentblockingerror', function(messagecode) {
        //if the message exists, it should already be translated.
        if (messagecode) {
            $("#safari_content_blocking_bmessage").text(messagecode).show();
        } else {
            $("#safari_content_blocking_bmessage").text("").hide();
        }
    });
}

// Authenticate button for login/logoff with Dropbox
$("#dbauth").click(function() {
    BGcall("dropboxauth", function(status) {
        if (status === true) {
            BGcall("dropboxlogout");
        } else {
            BGcall("dropboxlogin");
        }
    });
});

$("#dbauthinfo").click(function() {
    BGcall("openTab",
           "http://help.getadblock.com/support/solutions/articles/6000087888-how-do-i-use-dropbox-synchronization-");
});

// Change Dropbox button, when user has been logged in/out
function update_db_icon() {
    if (!SAFARI &&
        chrome &&
        chrome.runtime &&
        chrome.runtime.onMessage) {
        BGcall("dropboxauth", function(status) {
            if (status === true) {
                $("#dbauth").addClass("authenticated");
                $("#dbauth").removeClass("not-authenticated");
            } else {
                $("#dbauth").addClass("not-authenticated");
                $("#dbauth").removeClass("authenticated");
            }
        });
    }
}

function getDropboxMessage() {
    BGcall('sessionstorage_get', 'dropboxerror', function(messagecode) {
        //if the message exists, it should already be translated.
        if (messagecode) {
            $("#dbmessage").text(messagecode);
        }
    });
}
// Listen for Dropbox sync changes
if (!SAFARI &&
    chrome &&
    chrome.runtime &&
    chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            if (request.message === "update_checkbox") {
                BGcall("get_settings", function(settings) {
                    $("input[id='enable_youtube_channel_whitelist']").prop("checked", settings.youtube_channel_whitelist);
                    $("input[id='enable_show_context_menu_items']").prop("checked", settings.show_context_menu_items);
                    $("input[id='enable_show_advanced_options']").prop("checked", settings.show_advanced_options);
                    $("input[id='enable_whitelist_hulu_ads']").prop("checked", settings.whitelist_hulu_ads);
                    $("input[id='enable_debug_logging']").prop("checked", settings.debug_logging);
                });
                sendResponse({});
            }
            if (request.message === "update_icon") {
                update_db_icon();
                sendResponse({});
            }
            if (request.message === "update_page") {
                document.location.reload();
                sendResponse({});
            }
            if (request.message === "dropboxerror" && request.messagecode) {
                $("#dbmessage").text(request.messagecode);
                sendResponse({});
            }
            if (request.message === "cleardropboxerror") {
                $("#dbmessage").text("");
                sendResponse({});
            }
        }
    );
}
