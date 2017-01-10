$(document).ready(function() {

    // Check for updates
    $("#checkupdate").html(translate("checkforupdates"));
    checkupdates("help");

    // Display a warning while submitting a bug report,
    // that users should submit them in English
    if (determineUserLanguage() !== "en") {
        $(".english-only").css("display", "inline");
    }

    chrome.runtime.getBackgroundPage(function(backgroundPage) {

        var debug_data = null;

        function processDebugData(debugInfo) {
            // |debugInfo| is the debug info object from the BG page
            var content = [];

            content.push("=== Filter Lists ===");
            content.push(debugInfo.filter_lists);
            content.push("");

            // Custom & Excluded filters might not always be in the object
            if (debugInfo.custom_filters) {
                content.push("=== Custom Filters ===");
                content.push(debugInfo.custom_filters);
                content.push("");
            }

            if (debugInfo.exclude_filters) {
                content.push("=== Exclude Filters ===");
                content.push(debugInfo.exclude_filters);
                content.push("");
            }

            content.push("=== Settings ===");
            content.push(debugInfo.settings);
            content.push("");

            content.push("=== Other Info ===");
            content.push(debugInfo.other_info);

            // Put it together to put into the textbox
            debug_data = content.join("\n");
        }

        // Get debug info
        // BG page is not defined on Safari
        if (!backgroundPage) {
            BGcall("getDebugInfo", function(debugInfo) {
                processDebugData(debugInfo);
            });
        } else {
            backgroundPage.getDebugInfo(function(debugInfo) {
                processDebugData(debugInfo);
            });
        }

        // Show debug data
        $("#debug").click(function() {
            $("#debugInfo").html(debug_data);
            $("#debugInfo").css({ width: "450px", height: "100px"});
            $("#debugInfo").fadeIn();
        });
    });

    // Report us the bug
    $("#report a").click(function() {
        BGcall("makeReport", function(report) {
            var result = "https://github.com/CatBlock/catblock/issues/new?body=" + report;
            document.location.href = result;
        });
    });

    // Show the changelog
    $("#whatsnew a").click(function() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", chrome.runtime.getURL("CHANGELOG.txt"), true);
        xhr.overrideMimeType("text/plain");
        xhr.onreadystatechange = function() {
            if (this.readyState === 4 && this.responseText !== "") {
                $("#changes").text(xhr.responseText).css({ width: "670px", height: "200px" }).fadeIn();
            }
        };
        xhr.send();
    });
});