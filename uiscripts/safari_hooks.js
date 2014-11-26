// This file is only loaded by Safari.  Chrome uses chrome.tabs.executeScript
// in lieu of broadcasts, and registers context menus in background.html.

// TODO: free to make this Safari-specific if that's helpful
(function() {
  // Handle broadcasted instructions
  var dispatcher = {};
  if (window == window.top) {
    dispatcher['top_open_whitelist_ui'] = top_open_whitelist_ui;
    dispatcher['top_open_blacklist_ui'] = top_open_blacklist_ui;
  }
  dispatcher['send_content_to_back'] = send_content_to_back;

  var port = chrome.extension.connect({name: "Broadcast receiver"});
  port.onMessage.addListener(function(request) {
    if (dispatcher[request.fn])
      dispatcher[request.fn](request.options);
  });
})();

// Handle right click menu item click
safari.self.addEventListener("message", function(event) {
  if (event.name == "show-whitelist-wizard")
    BGcall('emit_page_broadcast', {fn:'top_open_whitelist_ui', options:{}});
  else if (event.name == "show-blacklist-wizard")
    BGcall('emit_page_broadcast', {fn:'top_open_blacklist_ui', options:{}});
  else if (event.name == "show-clickwatcher-ui")
    BGcall('emit_page_broadcast', {fn:'top_open_blacklist_ui', options:{nothing_clicked:true}});
}, false);
