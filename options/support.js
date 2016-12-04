$(document).ready(function() {

    // Check for updates
    $("#checkupdate").html(translate("checkforupdates"));
    checkupdates("help");

    // Display a warning while submitting a bug report,
    // that users should submit them in English
    if (determineUserLanguage() !== "en") {
        $(".english-only").css("display", "inline");
    }

    // Show debug info
    $("#debug").click(function() {
        BGcall("getDebugInfo", function(the_debug_info) {
            // the_debug_info is the debug info object from the BG page
            content = [];
            content.push("=== Filter Lists ===");
            content.push(the_debug_info.filter_lists);
            content.push("");

            // Custom & Excluded filters might not always be in the object
            if (the_debug_info.custom_filters) {
                content.push("=== Custom Filters ===");
                content.push(the_debug_info.custom_filters);
                content.push("");
            }

            if (the_debug_info.exclude_filters) {
                content.push("=== Exclude Filters ===");
                content.push(the_debug_info.exclude_filters);
                content.push("");
            }

            content.push("=== Settings ===");
            content.push(the_debug_info.settings);
            content.push("");
            content.push("=== Other Info ===");
            content.push(the_debug_info.other_info);

            // Put it together to put into the textbox
            debug_info = content.join("\n");

            $("#debugInfo").html(debug_info);
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