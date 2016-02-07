var debug_info;
var text_debug_info = "";
var ext_info = "";
$(document).ready(function() {

    // Retrieve extension info
    var askUserToGatherExtensionInfo = function() {
        if (chrome &&
            chrome.permissions &&
            chrome.permissions.request) {
            chrome.permissions.request({
                permissions: ['management']
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
                            extInfo.push("  enabled: " + result[i].enabled)
                            extInfo.push("  type: " + result[i].type);
                            extInfo.push("");
                        }
                        ext_info = "\nExtensions:\n" + extInfo.join("\n");
                        chrome.permissions.remove({
                            permissions: ['management']
                        }, function(removed) {});
                        continueProcessing();
                    });
                } else {
                    //user didn't grant us permission
                    ext_info = "Permission not granted";
                    continueProcessing();
                }
            }); //end of permission request
        } else {
            //not supported in this browser
            ext_info = "no extension information";
            continueProcessing();
        }
    }

    // Get debug info
    BGcall("getDebugInfo", function(info) {
        debug_info = info;
        debug_info.language = determineUserLanguage();
        // Get written debug info
        // info is the debug info object
        content = [];
        content.push("=== Filter Lists ===");
        content.push(debug_info.filter_lists);
        content.push("");
        // Custom & Excluded filters might not always be in the object
        if (debug_info.custom_filters) {
            content.push("=== Custom Filters ===");
            content.push(debug_info.custom_filters);
            content.push("");
        }
        if (debug_info.exclude_filters) {
            content.push("=== Exclude Filters ===");
            content.push(debug_info.exclude_filters);
            content.push("");
        }
        content.push("=== Settings ===");
        content.push(debug_info.settings);
        content.push("");
        content.push("=== Other Info ===");
        content.push(debug_info.other_info);
        // Put it together to put into the textbox
        text_debug_info = content.join("\n");
    });

    // Cache access to input boxes
    var $name = $("#name");
    var $email = $("#email");
    var $title = $("#summary");
    var $repro = $("#repro-steps");
    var $expect = $("#expected-result");
    var $actual = $("#actual-result");
    var $comments = $("#other-comments");

    if (storage_get("user_name") !== undefined) {
        $name.val(storage_get("user_name"));
    }
    if (storage_get("user_email") !== undefined) {
        $email.val(storage_get("user_email"));
        $("#rememberDetails").prop("checked", true);
    }
    var handleResponseError = function(respObj) {
        if (respObj &&
            respObj.hasOwnProperty("error_msg")) {
            $("#step_response_error_msg").text(translate(respObj["error_msg"]));
        }
        $("#manual_report_DIV").show();
        $("#step_response_error").fadeIn();
        $('html, body').animate({
            scrollTop: $("#step_response_error").offset().top
        }, 2000);
    }

    var sendReport = function() {
        var report_data = {
            title: $title.val(),
            repro: $repro.val(),
            expect: $expect.val(),
            actual: $actual.val(),
            debug: debug_info,
            name: $name.val(),
            email: $email.val(),
            comments: $comments.val(),
        };
        if (ext_info) {
            report_data.debug.extensions = ext_info;
        }
        $.ajax({
            url: "https://getadblock.com/freshdesk/bugReport.php",
            data: {
                bug_report: JSON.stringify(report_data)
            },
            success: function(text) {
                // if a ticket was created, the response should contain a ticket id #
                if (text) {
                    try {
                        var respObj = JSON.parse(text);
                        if (respObj &&
                            respObj.hasOwnProperty("helpdesk_ticket") &&
                            respObj["helpdesk_ticket"].hasOwnProperty("display_id")) {
                            $("#step_response_success").fadeIn();
                            $('html, body').animate({
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

    // Preparation for manual report in case of error.
    var prepareManualReport = function(data, status, HTTPerror, respObj) {
        var body = [];
        body.push("This bug report failed to send.");
        body.push("");
        body.push("* Repro Steps *");
        body.push(data.repro);
        body.push("");
        body.push("* Expected Result *");
        body.push(data.expect);
        body.push("");
        body.push("* Actual Result *");
        body.push(data.actual);
        body.push("");
        body.push("* Other comments *");
        body.push(data.comments);
        body.push("");
        body.push("");
        body.push("");
        body.push("===== Debug Info =====");
        body.push(text_debug_info);
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

    var continueProcessing = function() {
        $("#debug-info").val(text_debug_info);
        $("#step2-back").prop("disabled", false);
        $("#step_final_questions").fadeIn();
        // Auto-scroll to bottom of the page
        $("html, body").animate({
            scrollTop: 15000
        }, 50);
        if ($("#rememberDetails").is(":checked")) {
            storage_set("user_name", $name.val());
            storage_set("user_email", $email.val());
        }
    }

    // Step 1: Name & Email
    $("#step1-next").click(function() {
        // Check for errors
        var problems = 0;
        if ($name.val() === "") {
            problems++;
            $name.addClass("inputError");
        } else {
            $name.removeClass("inputError");
        }
        if ($email.val() === "" ||
            $email.val().search(/^.+@.+\..+$/) === -1) {
            problems++;
            $email.addClass("inputError");
        } else {
            $email.removeClass("inputError");
        }
        if ($title.val() === "") {
            problems++;
            $title.addClass("inputError");
        } else {
            $title.removeClass("inputError");
        }
        if ($repro.val() === "1. \n2. \n3. ") {
            problems++;
            $repro.addClass("inputError");
        } else {
            $repro.removeClass("inputError");
        }
        if ($expect.val() === "") {
            problems++;
            $expect.addClass("inputError");
        } else {
            $expect.removeClass("inputError");
        }
        if ($actual.val() === "") {
            problems++;
            $actual.addClass("inputError");
        } else {
            $actual.removeClass("inputError");
        }
        if (problems === 0) {
            // Success - go to next step
            $(this).prop("disabled", true);
            $("#email, #name, #rememberDetails").prop("disabled", true);
            $("#summary, #repro-steps, #expected-result, #actual-result").prop("disabled", true);
            $(".missingInfoMessage").hide();
            askUserToGatherExtensionInfo();
        } else {
            // Failure - let them know there's an issue
            $("#step_name_email > .missingInfoMessage").show();
        }
    });

    $("#step2-back").click(function() {
        $("#email, #name, #rememberDetails").prop("disabled", false);
        $("#summary, #repro-steps, #expected-result, #actual-result").prop("disabled", false);
        $("#step_repro_info").fadeOut();
        $("#step_final_questions").fadeOut();
        $('html, body').animate({
            scrollTop: $("#step_name_email").parent().parent().offset().top
        }, 2000);
        $("#step2-back").prop("disabled", true);
        $("#step1-next").prop("disabled", false);
    });

    $("#submit").click(function() {
        sendReport();
        $("#submit").prop("disabled", true);
        $("#step2-back").prop("disabled", true);
    });
});