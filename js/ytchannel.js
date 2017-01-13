// Store actual URL
var url = document.location.href;

// Get id of the channel
function getChannelId(url) {
    return new parseURI(url).pathname.split("/")[2];
}

// Get id of the video
function getVideoId(url) {
    return parseURI.parseSearch(url).v;
}

// Function which: - adds name of the channel on the end of the URL, e.g. &ab_channel=nameofthechannel
//                 - reload the page, so AdBlock can properly whitelist the page (just if channel is whitelisted by user)
function updateURL(channelName, shouldReload) {
    var updatedUrl = "";
    if (new parseURI(url).search.indexOf("?") === -1) {
        updatedUrl = url + "?&ab_channel=" + channelName.replace(/\s/g, "");
    } else {
        updatedUrl = url + "&ab_channel=" + channelName.replace(/\s/g, "");
    }
    // Add the name of the channel to the end of URL
    window.history.replaceState(null, null, updatedUrl);
    // |shouldReload| is true only if we are not able to get
    // name of the channel by using YouTube Data v3 API
    if (shouldReload) {
        // Reload page from cache, if it should be whitelisted
        BGcall("page_is_whitelisted", updatedUrl, function(whitelisted) {
            if (whitelisted) {
                document.location.reload(false);
            }
        });
    }
}

if (!/ab_channel/.test(url)) {
    // Get name of the channel by using YouTube Data v3 API
    if (/channel/.test(url)) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET",
                 "https://www.googleapis.com/youtube/v3/channels?part=snippet&id=" + getChannelId(url) +
                 "&key=" + atob("QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz"), true);
        xhr.overrideMimeType("application/json");
        xhr.onload = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var json = JSON.parse(xhr.response);
                // Got name of the channel
                if (json.items[0]) {
                    updateURL(json.items[0].snippet.title, false);
                }
            }
        };
        xhr.send(null);
    } else if (/watch/.test(url)) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET",
                 "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + getVideoId(url) +
                 "&key=" + atob("QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz"), true);
        xhr.overrideMimeType("application/json");
        xhr.onload = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var json = JSON.parse(xhr.response);
                // Got name of the channel
                if (json.items[0]) {
                    updateURL(json.items[0].snippet.channelTitle, false);
                }
            }
        };
        xhr.send(null);
    } else {
        if (/user/.test(url)) {
            document.addEventListener("spfdone", function() {
                var channelName = document.querySelector("span .qualified-channel-title-text > a").textContent;
                if (channelName) {
                    updateURL(channelName, true);
                }
            }, true);
            // Spfdone event doesn't fire, when you access YT user directly
            window.addEventListener("DOMContentLoaded", function() {
                var channelName = document.querySelector("span .qualified-channel-title-text > a").textContent;
                if (channelName) {
                    updateURL(channelName, true);
                }
            }, true);
        }
    }
}
