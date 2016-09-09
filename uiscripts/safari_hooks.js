// This file is only loaded by Safari. Chrome uses chrome.tabs.executeScript
// in lieu of broadcasts, and registers context menus in background.js.

// Handle emit_page_broadcast
safari.self.addEventListener("message", function(event) {
    if (event.name === "page-broadcast") {
        if (event.message.fn === "send_content_to_back") {
            send_content_to_back();
        }
    }
});

// Handle message event generated in toolbar button and right click menu item
// "command" event handler
if (window === window.top) {
    safari.self.addEventListener("message", function(event) {
        if (event.name === "show-whitelist-wizard") {
            top_open_whitelist_ui({});
        } else if (event.name === "show-blacklist-wizard") {
            top_open_blacklist_ui({});
        } else if (event.name === "show-clickwatcher-ui") {
            top_open_blacklist_ui({ nothing_clicked: true });
        }
    }, false);
}
