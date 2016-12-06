const CATS = {
    init: function(callback) {
        const self = this;

        // Don't enable Project CATS on Safari and Edge
        if (SAFARI || EDGE) {
            if (self.isEnabled() === undefined) {
                self.disable();
                callback();
            }
        }

        // First-time running code after installation, set "CATS" to disabled by default
        // Opening up installed page, which will determine,
        // whether CATS should be enabled or not
        if (self.isEnabled() === undefined && sessionstorage_get("installed")) {
            sessionstorage_set("installed"); // present with a new user

            const installedURL = "https://catblock.tk/installed.html";
            chrome.tabs.create({ url: installedURL }, function(data) {
                const tabId = data.id;
                const fileToInject = "js/cats-cs.js";

                // Wait for a message from a content script,
                // which tells us to enable "CATS"
                chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
                    if (request.command !== "enableprojectcats" &&
                        request.command !== "disableprojectcats") {
                        return;
                    }
                    if (request.command === "enableprojectcats") {
                        self.enable();
                        callback();
                    } else {
                        self.disable();
                        callback();
                    }
                });

                // Inject cats-cs content script, which determines,
                // whether Project CATS should be allowed or not
                chrome.tabs.executeScript(tabId, { file: fileToInject });
            });
            // When "CATS" is enabled,
            // we don't need to have our listener running
        } else if (self.isEnabled()) {
            return callback();
        // Existing users should not have "Project CATS" enabled
        } else if (self.isEnabled() === false || self.isEnabled() === undefined) {
            return callback();
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