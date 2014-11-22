// BGcall DISPATCH
(function() {
  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      if (request.command != "call")
        return; // not for us

      var target = window;
      var parts = request.fn.split('.');
      for (var i=0; i < parts.length-1; i++) {
        target = target[parts[i]];
      }
      var fnName = parts[parts.length-1];
      var fn = target[fnName];
      request.args.push(sender);
      var result = fn.apply(target, request.args);
      sendResponse(result);
    }
  );
})();

if (!SAFARI) {
  // Listens for message from CatBlock content script asking to load jQuery.
  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      if (request.command === "inject_jquery") {
        chrome.tabs.executeScript(undefined,
          {allFrames: request.allFrames, file: "../jquery/jquery.min.js"},
          function() { sendResponse({}); }
        );
      }
    }
  );
}

channels = new Channels();