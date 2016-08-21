var CATS = {
    init: function(callback) {
        var self = this;

        // First-time running code after installation, set "CATS" to disabled by default
        if (self.isEnabled() === undefined) {
            //var installURL = "http://catblock.tk/project-cats.html";
            var installURL = "https://catblock.tk/";
            chrome.tabs.create({ url: installURL }, function(data) {
                var tabId = data.id;
                var fileToInject = "js/cats-cs.js";
                chrome.tabs.executeScript(tabId, { file: fileToInject });
            });
            //self.disable(); todo
        // When "CATS" is enabled,
        // we don't need to have our listener running
        } else if (self.isEnabled()) {
            return callback();
        }

        // Wait for a message from a content script,
        // which tells us to enable "CATS"
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (request.command !== "allowprojectcats" &&
                request.command !== "disallowprojectcats") {
                return;
            }
            if (request.command === "allowprojectcats") {
                //self.enable();
                console.log("allowing cats");
            } else {
                //self.disable();
                console.log("disabling cats");
            }
        });
    },
    enable: function() {
        storage_set("project_cats", true);
    },
    disable: function() {
        storage_set("project_cats", false);
    },
    isEnabled: function() {
        return storage_get("project_cats");
    }
}