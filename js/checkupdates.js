// Check for updates
function checkupdates(page) {

    // Check if newVersion is newer than AdBlockVersion
    function isNewerVersion(newVersion) {
        var versionRegex = /^(\*|\d+(\.\d+){0,2}(\.\*)?)$/;
        var AdBlockVersion = chrome.runtime.getManifest().version;
        var current = AdBlockVersion.match(versionRegex);
        var notCurrent = newVersion.match(versionRegex);
        if (!current || !notCurrent) {
            return false;
        }
        for (var i=1; i<4; i++) {
            if (current[i] < notCurrent[i]) {
                return true;
            }
            if (current[i] > notCurrent[i]) {
                return false;
            }
        }
        return false;
    }

    if (!EDGE) {
        var checkURL = "https://github.com/CatBlock/catblock/releases";

        // Fetch the version check file
        $.ajax({
            cache: false,
            dataType: "html",
            url: checkURL,
            error: function() {
                if (page === "help") {
                    $("#checkupdate").html(translate("somethingwentwrong")).show();
                } else {
                    $("#checkupdate").html(translate("checkinternetconnection")).show();
                }
            },
            success: function(response) {
                var parser = new DOMParser();
                var document = parser.parseFromString(response, "text/html");
                var version = document.querySelector(".release-timeline > .label-latest > " +
                                                     ".release-meta > .tag-references >li > .css-truncate > .css-truncate-target").textContent;
                if (isNewerVersion(version)) {
                    $("#checkupdate").html(translate("catblock_update_available"));
                    var updateURL = $("key:contains(URL) + string", response).text();
                    $("#here").html(translate("here")).attr("href", updateURL);
                    $(".step").hide();
                } else {
                    if (page === "help") {
                        // TODO: Change string for translation
                        $("#checkupdate").html(translate("catblock_latest_version")).show();
                    }
                }
            }
        });
    } else {
        var checkURL = "http://getcatblock.com/edge.json";

        // Fetch the version check file
        $.ajax({
            cache: false,
            dataType: "json",
            url: checkURL,
            error: function() {
                if (page === "help") {
                    $("#checkupdate").html(translate("somethingwentwrong")).show();
                } else {
                    $("#checkupdate").html(translate("checkinternetconnection")).show();
                }
            },
            success: function(response) {
                var latestVersion = response.version;
                var redirectUrl = response.redirect_url;
                if (isNewerVersion(latestVersion)) {
                    $("#checkupdate").html(translate("catblock_update_available"));
                    $("#here").html(translate("here")).attr("href", redirectUrl);
                    chrome.browserAction.setBadgeText({ text: "New!" });
                    storage_set("update_available", true);
                    $(".step").hide();
                } else {
                    chrome.browserAction.setBadgeText({text: ""});
                    storage_set("update_available", false);
                    if (page === "help") {
                        // TODO: Change string for translation
                        $("#checkupdate").html(translate("catblock_latest_version")).show();
                    }
                }
            }
        });
    }

    // Hide ad-reporting wizard, when user is offline
    if (page === "adreport" && $("#checkupdate").is(":visible")) {
        $(".section").hide();
    }
}