      chrome.extension.sendRequest({command:"get-license"}, function(license) {
        var page = (license.state === "enabled" ? "options/general.html" : "license/setup.html");
        var folder = (SAFARI ? "catblock/" : "");
        document.getElementById("iframe").src = chrome.extension.getURL(folder + page);
      });
