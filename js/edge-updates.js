// Check, whether an update is available or not
var STATUS = (function() {

    if (!EDGE) {
        return;
    }

    var url = "http://catblock.tk/edge.json";

    // Check if newVersion is newer than AdBlockVersion
    function isNewerVersion(newVersion) {
        // Get a version number
        var AdBlockVersion = chrome.runtime.getManifest().version;
        var versionRegex = /^(\*|\d+(\.\d+){0,2}(\.\*)?)$/;
        var current = AdBlockVersion.match(versionRegex);
        var notCurrent = newVersion.match(versionRegex);
        if (!current || !notCurrent) {
            return false;
        }
        for (var i=1; i<4; i++) {
            if (current[i] < notCurrent[i]) {
                return true;
            }
            if (current[i] > notCurrent[i]) {
                return false;
            }
        }
        return false;
    }

    function handleResponse(responseData) {
        var isNewerVersionAvailable = isNewerVersion(responseData.version);
        if (isNewerVersionAvailable) {
            console.log("newer version available");
            chrome.browserAction.setBadgeText({ text: "New!" });
            storage_set("update_available", true);
        } else {
            storage_set("update_available", false);
            console.log("catblock is up-to-date");
        }
    }

    // Check for an updated version of CatBlock for Edge
    function checkNow() {
        var ajaxOptions = {
            type: "GET",
            url: url,
            success: handleResponse,
            error: function(e) {
                console.log("Check returned an error: ", e.status);
            }
        };
        $.ajax(ajaxOptions);
    }



    // Called just after we ping the server, to schedule our next ping.
    function scheduleNextPing() {
        var total_pings = storage_get("total_pings") || 0;
        total_pings += 1;
        storage_set("total_pings", total_pings);

        var delay_hours;
        if (total_pings === 1) {      // Ping one hour after install
            delay_hours = 1;
        }
        else if (total_pings < 9) {  // Then every day for a week
            delay_hours = 24;
        }

        var millis = 1000 * 60 * 60 * delay_hours;
        storage_set("next_ping_time", Date.now() + millis);
    }

    // Return the number of milliseconds until the next scheduled ping.
    function millisTillNextPing() {
        var next_ping_time = storage_get("next_ping_time");
        if (!next_ping_time) {
            return 0;
        } else {
            return Math.max(0, next_ping_time - Date.now());
        }
    }

    return {
        // Ping the server when necessary.
        checkLatestVersion: function() {
            function sleepThenPing() {
                var delay = millisTillNextPing();
                window.setTimeout(function() {
                    checkNow();
                    scheduleNextPing();
                    sleepThenPing();
                }, delay);
            }
            // Try to detect corrupt storage and thus avoid ping floods.
            if (!(millisTillNextPing() > 0)) {
                storage_set("next_ping_time", 1);
                if (storage_get("next_ping_time") !== 1) {
                    return;
                }
            }
            // This will sleep, then ping, then schedule a new ping, then
            // call itself to start the process over again.
            sleepThenPing();
        }
    };

})();