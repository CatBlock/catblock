var CATS = {
    init: function(callback) {
        var self = this;

        // First-time running code after installation, set "CATS" to disabled by default
        // Opening up installed page, which will determine,
        // whether CATS should be enabled or not
        if (self.isEnabled() === undefined && sessionstorage_get("installed")) {
            sessionstorage_set("installed"); // present with a new user

            var installedURL = "https://catblock.tk/installed.html";
            chrome.tabs.create({ url: installedURL }, function(data) {
                var tabId = data.id;
                var fileToInject = "js/cats-cs.js";

                // Wait for a message from a content script,
                // which tells us to enable "CATS"
                chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
                    if (request.command !== "enableprojectcats" &&
                        request.command !== "disableprojectcats") {
                        return;
                    }
                    if (request.command === "enableprojectcats") {
                        self.enable();
                        callback(true);
                    } else {
                        self.disable();
                        callback(false);
                    }
                });

                // Inject cats-cs content script, which determines,
                // whether Project CATS should be allowed or not
                chrome.tabs.executeScript(tabId, { file: fileToInject });
            });
            // When "CATS" is enabled,
            // we don't need to have our listener running
        } else if (self.isEnabled()) {
            return callback(true);
        } else if (self.isEnabled() === false) {
            return callback(false);
        }
    },
    enable: function() {
        storage_set("project_cats", true);
    },
    disable: function() {
        storage_set("project_cats", false);
    },
    isEnabled: function() {
        //return true;
        return storage_get("project_cats");
    }
}