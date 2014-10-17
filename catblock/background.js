DEBUG_ADBLOCK = true;

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

storage_get = function(key) {
  var store = (window.SAFARI ? safari.extension.settings : localStorage);
  var json = store.getItem(key);
  if (json == null)
    return undefined;
  try {
    return JSON.parse(json);
  } catch (e) {
    log("Couldn't parse json for " + key);
    return undefined;
  }
};

// Inputs: key:string, value:object.
// Returns undefined.
storage_set = function(key, value) {
  var store = (window.SAFARI ? safari.extension.settings : localStorage);
  if (value === undefined) {
    store.removeItem(key);
    return;
  }
  try {
    store.setItem(key, JSON.stringify(value));
  } catch (ex) {
    // Safari throws this error for all writes in Private Browsing mode.
    // TODO: deal with the Safari case more gracefully.
    if (ex.name == "QUOTA_EXCEEDED_ERR" && !SAFARI) {
      alert(translate("storage_quota_exceeded"));
      openTab("options/index.html#ui-tabs-2");
    }
  }
};

if (!SAFARI) {
  // Open options on button click.
  chrome.browserAction.onClicked.addListener(function() {
    var page = chrome.extension.getURL("options/general.html");
    chrome.tabs.query({url:page}, function(results) {
      if (results.length > 0)
        chrome.tabs.update(results[0].id, {active:true, url:page});
      else
        chrome.tabs.create({url:page});
    });
  });


  // Listens for message from AdBlock with info about the selector that will
  // match ads on the page.
  chrome.extension.onRequestExternal.addListener(
    function(request, sender, sendResponse) {
      if (!DEBUG_ADBLOCK)
        return;
      chrome.tabs.sendRequest(request.tabId, request);
    }
  );

  // Listens for message from CatBlock content script asking to load jQuery.
  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      if (request.command === "inject_jquery") {
        chrome.tabs.executeScript(undefined,
          {allFrames: request.allFrames, file: "jquery.min.js"},
          function() { sendResponse({}); }
        );
      }
    }
  );
}

channels = new Channels();
