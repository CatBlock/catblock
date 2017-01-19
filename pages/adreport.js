var malwareDomains = null;
var extensionsDisabled = [];

$(function() {
    localizePage();

    //Shows the instructions for how to enable all extensions according to the browser of the user
    if (SAFARI) {
        $(".chrome_only").hide();
    } else {
        $(".safari_only").hide();
        var messageElement = $("li[i18n='disableforchromestepone']");
        messageElement.find("a").click(function() {
            if (OPERA) {
                chrome.tabs.create({
                    url: "opera://extensions/"
                });
            } else if (FIREFOX) {
                $("#disableotherextensions").hide(); // Hide an option for auto-disabling extensions
                chrome.tabs.create({
                    url: "about:addons"
                });
            } else if (EDGE) {
                $("#disableotherextensions").hide(); // Hide an option for auto-disabling extensions
                chrome.tabs.create({
                    url: "https://developer.microsoft.com/en-us/microsoft-edge/platform/documentation/extensions/adding-and-removing-extensions/"
                });
            } else {
                chrome.tabs.create({
                    url: "chrome://extensions/"
                });
            }
        });
    }

    // Sort the languages list
    var languageOptions = $("#step_language_lang option");
    languageOptions.sort(function(a, b) {
        if (!a.text) {
            return -1;
        }
        if (!b.text) {
            return 1; // First one is empty
        }
        if (!a.value) {
            return 1;
        }
        if (!b.value) {
            return -1; // 'Other' at the end
        }
        if (a.getAttribute("i18n") === "lang_english") {
            return -1; // English second
        }
        if (b.getAttribute("i18n") === "lang_english") {
            return 1;
        }
        return (a.text > b.text) ? 1 : -1;
    });
    $("#step_language_lang").empty().append(languageOptions);
    languageOptions[0].selected = true;

    // add the link to the anchor in "adreport2"
    $("a", "#info").attr("href", "http://help.getadblock.com/support/solutions/articles/6000061202").attr("target", "_blank");

    // Show ad report page
    $("body").fadeIn();
});

// Fetching the options...
var options = parseURI.parseSearch(document.location.search);
var tabId = options.tabId.replace(/[^0-9]/g, "");

// Get the list of all unsubscribed default filters
var unsubscribed_default_filters = [];
BGcall("get_subscriptions_minus_text", function(subs) {
    for (var id in subs) {
        if (!subs[id].subscribed && !subs[id].user_submitted) {
            unsubscribed_default_filters[id] = subs[id];
        }
    }
});

// Get debug info
chrome.runtime.getBackgroundPage(function(backgroundPage) {
    if (!backgroundPage) {
        BGcall("getDebugInfo", function(debugInfo) {
            debug_info = debugInfo;
        });
    } else {
        backgroundPage.getDebugInfo(function(debugInfo) {
            debug_info = debugInfo;
        });
    }
});

function sendReport() {
    // Cache access to input boxes
    var $name = $("#step_report_name");
    var $email = $("#step_report_email");
    var $location = $("#step_report_location");
    var $filter = $("#step_report_filter");
    var problems = 0;
    // Reset any error messages
    $("#screen_capture_file_label")
        .css("color", "black");
    $email.removeClass("inputError");
    $name.removeClass("inputError");
    $("#step_response_error")
        .parent()
        .fadeOut();
    $("#step_response_success")
        .parent()
        .fadeOut();
    $("#adreport_missing_info")
        .hide();
    $("#adreport_missing_screenshot")
        .hide();
    // Validate user entered info
    if ($name.val() === "") {
        problems++;
        $name.addClass("inputError");
        $("#adreport_missing_info")
            .show();
    }
    if ($email.val() === "" ||
        $email.val()
        .search(/^.+@.+\..+$/) === -1) {
        problems++;
        $email.addClass("inputError");
        $("#adreport_missing_info")
            .show();
    }
    if ($("#screen_capture_file")[0].files.length === 0) {
        $("#adreport_missing_screenshot")
            .show();
        problems++;
        $("#screen_capture_file_label")
            .css("color", "#f00");
    }
    if (problems) {
        $("html, body").animate({
            scrollTop: $("#adreport_missing_info").offset().top
        }, 2000);
        return;
    }

    var report_data = {
        title: "Ad Report",
        name: $name.val(),
        email: $email.val(),
        location: $location.val(),
        filter: $filter.val(),
        debug: debug_info,
        url: ""
    };

    var domain = "";
    if (options.url) {
        domain = new parseURI(options.url).hostname;
        report_data.title = report_data.title + ": " + domain;
        report_data.url = options.url;
    }
    var the_answers = [];
    var answers = $("span[class='answer']");
    var text = $("div[class='section']:visible");
    var minArrayLength = Math.min(answers.length, text.length);
    for (var i = 0; i < minArrayLength; i++) {
        the_answers.push((i + 1) + "." + text[i].id + ": " + answers[i].getAttribute("chosen"));
    }
    report_data.answers = the_answers.join("\n");

    // Retrieve extension info
    function askUserToGatherExtensionInfo() {
        if (chrome &&
            chrome.permissions &&
            chrome.permissions.request) {
            chrome.permissions.request({
                permissions: ["management"]
            }, function(granted) {
                // The callback argument will be true if the user granted the permissions.
                if (granted) {
                    chrome.management.getAll(function(result) {
                        var extInfo = [];
                        for (var i = 0; i < result.length; i++) {
                            extInfo.push("Number " + (i + 1));
                            extInfo.push("  name: " + result[i].name);
                            extInfo.push("  id: " + result[i].id);
                            extInfo.push("  version: " + result[i].version);
                            extInfo.push("  enabled: " + result[i].enabled);
                            extInfo.push("  type: " + result[i].type);
                            extInfo.push("");
                        }
                        report_data.extensions = extInfo.join("\n");
                        chrome.permissions.remove({
                            permissions: ["management"]
                        }, function() {});
                        sendData();
                        return;
                    });
                } else {
                    //user didn't grant us permission
                    report_data.extensions = "Permission not granted";
                    sendData();
                    return;
                }
            });
        } else {
            //user didn't grant us permission
            report_data.extensions = "Extension information not avaiable";
            sendData();
        }
    } //end of askUserToGatherExtensionInfo

    function sendData() {
        var formdata = new FormData();
        formdata.append("ad_report", JSON.stringify(report_data));

        if ($("#screen_capture_file")[0].files.length > 0) {
            formdata.append("screencapturefile", $("#screen_capture_file")[0].files[0]);
        }

        $("#debug-info").val(createReadableReport(report_data));
        $.ajax({
            url: "https://getadblock.com/freshdesk/adReport.php",
            data: formdata,
            contentType: false,
            processData: false,
            success: function(text) {
                $("#step_report_submit").prop("disabled", true);
                // if a ticket was created, the response should contain a ticket id #
                if (text) {
                    try {
                        var respObj = JSON.parse(text);
                        if (respObj &&
                            respObj.hasOwnProperty("helpdesk_ticket") &&
                            respObj.helpdesk_ticket.hasOwnProperty("display_id")) {
                            $("#step_response_success")
                                .parent()
                                .fadeIn();
                            $("html, body").animate({
                                scrollTop: $("#step_response_success").offset().top
                            }, 2000);
                        } else {
                            prepareManualReport(report_data, null, null, respObj);
                            handleResponseError(respObj);
                        }
                    } catch (e) {
                        prepareManualReport(report_data);
                        handleResponseError();
                    }
                } else {
                    prepareManualReport(report_data);
                    handleResponseError();
                }
            },
            error: function(xhrInfo, status, HTTPerror) {
                prepareManualReport(report_data, status, HTTPerror);
                handleResponseError();
            },
            type: "POST"
        });
    }

    if (chrome &&
        chrome.tabs &&
        chrome.tabs.detectLanguage) {
        var tabIdInt = -1;
        try {
            tabIdInt = parseInt(tabId);
        } catch (e) {
            report_data.language = "unknown";
            askUserToGatherExtensionInfo();
            return;
        }
        chrome.tabs.detectLanguage(tabIdInt, function(language) {
            if (language) {
                report_data.language = language;
            }
            askUserToGatherExtensionInfo();
        }); //end of detectLanguage
    } else {
        report_data.language = "unknown";
        askUserToGatherExtensionInfo();
    }

    // Handle any HTTP or server errors
    function handleResponseError(respObj) {
        $("#step_response_error")
            .parent()
            .fadeIn();
        if (respObj &&
            respObj.hasOwnProperty("error_msg")) {
            $("#step_response_error_msg")
                .text(translate(respObj.error_msg));
        }
        //re-enable the button(s) if the error is recoverable (the user can re-submit)
        if (respObj &&
            respObj.hasOwnProperty("retry_allowed") &&
            respObj.retry_allowed === "true") {
            $("#step_report_submit")
                .prop("disabled", false);
            $("#step_response_error_manual_submission")
                .hide();
        } else {
            $("#step_response_error_manual_submission a")
                .attr("href", "https://adblocksupport.freshdesk.com/support/tickets/new");
            $("#step_response_error_manual_submission a")
                .attr("target", "_blank");
            $("#step_response_error_manual_submission")
                .show();
        }
        $("html, body").animate({
            scrollTop: $("#step_response_error").offset().top
        }, 2000);
    }
} // end of sendReport()

function createReadableReport(data) {
    var body = [];
    if (data.location) {
        body.push("* Location of ad *");
        body.push(data.location);
    }
    if (data.expect) {
        body.push("");
        body.push("* Working Filter? *");
        body.push(data.expect);
    }
    body.push("");

    // Get written debug info
    // data.debug is the debug info object
    content = [];
    content.push("* Debug Info *");
    content.push("");
    if (data.debug &&
        data.debug.filter_lists) {
        content.push("=== Filter Lists ===");
        content.push(data.debug.filter_lists);
    }
    content.push("");
    // Custom & Excluded filters might not always be in the object
    if (data.custom_filters) {
        content.push("=== Custom Filters ===");
        content.push(data.debug.custom_filters);
        content.push("");
    }
    if (data.exclude_filters) {
        content.push("=== Exclude Filters ===");
        content.push(data.debug.exclude_filters);
        content.push("");
    }
    if (data.debug &&
        data.debug.settings) {
        content.push("=== Settings ===");
        content.push(data.debug.settings);
    }
    content.push("");
    if (data.debug &&
        data.debug.other_info) {
        content.push("=== Other Info ===");
        content.push(data.debug.other_info);
    }
    body.push(content.join("\n"));
    body.push("");
    return body.join("\n");
}

// Pretty Print the data
function prepareManualReport(data, status, HTTPerror, respObj) {
    var body = [];
    body.push(createReadableReport(data));
    if (status) {
        body.push("Status: " + status);
    }
    if (HTTPerror) {
        body.push("HTTP error code: " + HTTPerror);
    }
    if (respObj) {
        body.push("Server error information: " + JSON.stringify(respObj));
    }
    $("#manual_submission").val(body.join("\n"));
}

// Check every domain of downloaded resource against malware-known domains
function checkmalware() {
    BGcall("get_frameData", tabId, function(frameData) {
        if (!frameData) {
            return;
        }

        var frames = [];
        var loaded_resources = [];
        var extracted_domains = [];
        var infected = null;

        // Get all loaded frames
        if (!SAFARI) {
            // Get all loaded frames
            for (var object in frameData) {
                if (!isNaN(object)) {
                    frames.push(object);
                }
            }
            // Push loaded resources from each frame into an array
            for (var i = 0; i < frames.length; i++) {
                if (Object.keys(frameData[frames[i]].resources)
                    .length !== 0) {
                    loaded_resources.push(frameData[frames[i]].resources);
                }
            }
        } else {
            // Push loaded resources into an array
            if (Object.keys(frameData.resources)
                .length !== 0) {
                loaded_resources.push(frameData.resources);
            }
        }

        // Extract domains from loaded resources
        for (var i = 0; i < loaded_resources.length; i++) {
            for (var key in loaded_resources[i]) {
                // Push just domains, which are not already in extracted_domains array
                var resource = key.split(":|:");
                if (resource &&
                    resource.length === 2 &&
                    extracted_domains.indexOf(new parseURI(resource[1]).hostname) === -1) {
                    extracted_domains.push(new parseURI(resource[1]).hostname);
                }
            }
        }

        // Compare domains of loaded resources with domain.json
        for (var i = 0; i < extracted_domains.length; i++) {
            if (malwareDomains &&
                extracted_domains[i] &&
                malwareDomains[extracted_domains[i].charAt(0)] &&
                malwareDomains[extracted_domains[i].charAt(0)].indexOf(extracted_domains[i]) > -1) {
                // User is probably infected by some kind of malware,
                // because resource has been downloaded from malware/adware/spyware site.
                var infected = true;
            }
        }
        $(".loader").hide();
        if (infected) {
            $("#step_update_filters_DIV").hide();
            $("#malwarewarning").html(translate("malwarewarning"));
            $("a", "#malwarewarning")
                .attr("href", "http://help.getadblock.com/support/solutions/articles/6000055822-i-m-seeing-similar-ads-on-every-website-");
        } else {
            $("#step_update_filters_DIV").show();
            $("#malwarewarning").html(translate("malwarenotfound"));
        }
        $("#malwarewarning").show();
    });
}

// Auto-scroll to bottom of the page
$("input, select").change(function(event) {
    event.preventDefault();
    $("html, body").animate({
        scrollTop: 15000
    }, 50);
});

// STEP 1: Malware/adware detection
function checkAdvanceOptions() {
    // Check, if downloaded resources are available,
    // if not, just reload tab with parsed tabId
    BGcall("get_settings", function(settings) {

        // We can't do a malware check when content blocking is enabled, so skip it.
        if (settings.safari_content_blocking) {
            $("#step_malware_checking_DIV").hide();
            $("#step_update_filters_DIV").show();
            return;
        } else if (SAFARI) {
            $("#step_malware_checking_DIV").show();
        }

        if (settings.show_advanced_options) {
            checkmalware();
        } else {
            BGcall("set_setting", "show_advanced_options");
            BGcall("reloadTab", parseInt(tabId));
            chrome.runtime.onMessage.addListener(
                function(message, sender, sendResponse) {
                    if (message.command === "reloadcomplete") {
                        BGcall("disable_setting", "show_advanced_options");
                        checkmalware();
                        sendResponse({});
                    }
                }
            );
        }
    });
}

// Fetch file with malware-known domains
function fetchMalware() {
    var xhr = new XMLHttpRequest();
    // The timestamp is add to the URL to prevent caching by the browser
    xhr.open("GET", "https://data.getadblock.com/filters/domains.json?timestamp=" + new Date()
             .getTime(), true);
    xhr.overrideMimeType("application/json");
    xhr.onload = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var parsedText = JSON.parse(xhr.responseText);
            var domains = parsedText.adware;
            var result = {};
            for (var i = 0; i < domains.length; i++) {
                var domain = domains[i];
                var char = domain.charAt(0);
                if (!result[char]) {
                    result[char] = [];
                }
                result[char].push(domain);
            }
            malwareDomains = result;
            checkAdvanceOptions();
        }
    };
    xhr.send();
}

// Attempt to get the malwareDomains from the background page first
// if the returned domains is null, then fetch them directly from the host.
BGcall("getMalwareDomains", function(domains) {
    if (domains) {
        malwareDomains = domains;
        checkAdvanceOptions();
    } else {
        fetchMalware();
    }
});

// STEP 2: update filters

// Updating the users filters
$("#UpdateFilters").click(function() {
    $(this).prop("disabled", true);
    BGcall("update_subscriptions_now", function() {
        $(".afterFilterUpdate input").prop("disabled", false);
        $(".afterFilterUpdate").removeClass("afterFilterUpdate");
    });
});

// If the user clicks a radio button
$("#step_update_filters_no").click(function() {
    $("#step_update_filters")
        .html("<span class='answer' chosen='no'>" + translate("no") + "</span>");
    $("#checkupdate")
        .text(translate("adalreadyblocked"));
});
$("#step_update_filters_yes").click(function() {
    $("#step_update_filters")
        .html("<span class='answer' chosen='yes'>" + translate("yes") + "</span>");

    $("#step_disable_extensions_DIV")
        .fadeIn()
        .css("display", "block");
});


// STEP 3: disable all extensions

//Code for displaying the div is in the $function() that contains localizePage()
//after user disables all extensions except for AdBlock
//if the user clicks a radio button
$("#step_disable_extensions_no").click(function() {
    $("#step_disable_extensions")
        .html("<span class='answer' chosen='no'>" + translate("no") + "</span>");
    $("#checkupdate")
        .text(translate("reenableadsonebyone"));
});
$("#step_disable_extensions_yes").click(function() {
    $("#step_disable_extensions")
        .html("<span class='answer' chosen='yes'>" + translate("yes") + "</span>");
    $("#step_language_DIV")
        .fadeIn()
        .css("display", "block");
    if (chrome.permissions && chrome.permissions.request && extensionsDisabled.length > 0) {
        chrome.permissions.request({
            permissions: ["management"]
        }, function(granted) {
            // The callback argument will be true if the user granted the permissions.
            if (granted) {
                for (var i = 0; i < extensionsDisabled.length; i++) {
                    chrome.management.setEnabled(extensionsDisabled[i], true);
                }
                alert(translate("enableotherextensionscomplete"));
            } else {
                alert(translate("manuallyenableotherextensions"));
            }
        });
    }
});

//Automatically disable / enable other extensions
$("#OtherExtensions").click(function() {
    $("#OtherExtensions").prop("disabled", true);
    if (chrome.permissions && chrome.permissions.request) {
        chrome.permissions.request({
            permissions: ["management"]
        }, function(granted) {
            // The callback argument will be true if the user granted the permissions.
            if (granted) {
                //remove the Yes/No buttons, so users don't click them to soon.
                $("#step_disable_extensions")
                    .fadeOut()
                    .css("display", "none");
                chrome.management.getAll(function(result) {
                    for (var i = 0; i < result.length; i++) {
                        if (result[i].enabled &&
                            result[i].mayDisable &&
                            result[i].id !== "mdcgnhlfpnbeieiiccmebgkfdebafodo" &&
                            result[i].id !== "pejeadkbfbppoaoinpmkeonebmngpnkk") {
                            // If the extension is a developer version, continue, don't disable.
                            if (result[i].installType === "development" &&
                                result[i].type === "extension" &&
                                result[i].name === "CatBlock") {
                                continue;
                            }
                            chrome.management.setEnabled(result[i].id, false);
                            extensionsDisabled.push(result[i].id);
                        }
                    }
                    chrome.permissions.remove({
                        permissions: ["management"]
                    }, function() {});
                    var alertDisplayed = false;
                    alert(translate("disableotherextensionscomplete"));
                    chrome.runtime.onMessage.addListener(
                        function(message, sender, sendResponse) {
                            if (!alertDisplayed && message.command === "reloadcomplete") {
                                alertDisplayed = true;
                                alert(translate("tabreloadcomplete"));
                                //we're done, redisplay the Yes/No buttons
                                $("#step_disable_extensions")
                                    .fadeIn()
                                    .css("display", "block");
                                sendResponse({});
                            }
                        }
                    );
                    BGcall("reloadTab", parseInt(tabId));
                }); // end of chrome.management.getAll()
            } else {
                $("#OtherExtensions").prop("disabled", false);
            }
        }); // end of chrome.permissions.request()
    }
});

// STEP 4: language

//if the user clicks an item
var contact = "";
$("#step_language_lang").change(function() {
    var selected = $("#step_language_lang option:selected");
    $("#step_language")
        .html("<span class='answer'>" + selected.text() + "</span>");
    $("#step_language span")
        .attr("chosen", selected.attr("i18n"));
    if (selected.text() === translate("other")) {
        $("#checkupdate")
            .html(translate("nodefaultfilter1"));
        $("#link")
            .html(translate("here"))
            .attr("href", "https://adblockplus.org/en/subscriptions");
        return;
    } else {
        var required_lists = selected.attr("value").split(";");
        for (var i = 0; i < required_lists.length - 1; i++) {
            if (unsubscribed_default_filters[required_lists[i]]) {
                $("#checkupdate")
                    .text(translate("retryaftersubscribe", [translate("filter" + required_lists[i])]));
                return;
            }
        }
    }
    contact = required_lists[required_lists.length - 1];

    $("#checkinfirefox1").html(translate("checkinfirefox_1"));
    $("#checkinfirefox2").html(translate("checkinfirefox_2"));
    $("#checkinfirefox").html(translate("checkinfirefoxtitle"));

    if (SAFARI || FIREFOX || EDGE) {
        $("#chrome1, #chrome2").html(translate("orchrome"));
        $("#adblockforchrome").html(translate("oradblockforchrome"));
    }

    $("#step_firefox_DIV")
        .fadeIn()
        .css("display", "block");
});

// STEP 5: also in Firefox

//If the user clicks a radio button
$("#step_firefox_yes").click(function() {
    $("#step_firefox")
        .html("<span class='answer' chosen='yes'>" + translate("yes") + "</span>");
    if (/^mailto\:/.test(contact)) {
        contact = contact.replace(" at ", "@");
    }
    var reportLink = "<a href='" + contact + "'>" + contact.replace(/^mailto\:/, "") + "</a>";
    $("#checkupdate")
        .html(translate("reportfilterlistproblem", [reportLink]));
    $("#privacy")
        .show();
});
$("#step_firefox_no").click(function() {
    $("#step_firefox")
        .html("<span class='answer' chosen='no'>" + translate("no") + "</span>");
    if (SAFARI) {
        // Safari can't block video ads
        $("#step_flash_DIV")
            .fadeIn()
            .css("display", "block");
    } else {
        $("#step_report_DIV")
            .fadeIn()
            .css("display", "block");
        if (debug_info) {
            $("#debug-info").val(createReadableReport({ "debug": debug_info }));
        }
    }
});

$("#step_firefox_wontcheck").click(function() {
    if (!SAFARI) {
        // Chrome blocking is good enough to assume the answer is 'yes'
        $("#step_firefox_yes").click();
    } else {
        // Safari can't do this.
        $("#checkupdate").text(translate("fixityourself"));
    }
    $("#step_firefox").html("<span class='answer' chosen='wont_check'>" + translate("refusetocheck") + "</span>");
});

// STEP 6: video/flash ad (Safari-only)

//If the user clicks a radio button
$("#step_flash_yes").click(function() {
    $("#step_flash").html("<span class='answer' chosen='yes'>" + translate("yes") + "</span>");
    $("#checkupdate").text(translate("cantblockflash"));
});
$("#step_flash_no").click(function() {
    $("#step_flash").html("<span class='answer' chosen='no'>" + translate("no") + "</span>");
    $("#step_report_DIV").fadeIn().css("display", "block");
    if (debug_info) {
        $("#debug-info").val(createReadableReport({
            "debug": debug_info
        }));
    }
});

// STEP 7: Ad Report
$("#step_report_submit").click(function() {
    sendReport();
});

checkupdates("adreport");