// Yes, you could hack my code to not check the license.  But please don't.
// Paying for this extension supports my work on AdBlock.  Thanks very much.
// - Michael Gundlach (adblockforchrome at gmail)

license = {
  get: function() {
    var theLicense = storage_get("license");
    if (!theLicense || !theLicense.userId) {
      var time_suffix = (Date.now()) % 1e8; // 8 digits from end of timestamp
      var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
      var letters = [];
      for (var i = 0; i < 8; i++) {
        var choice = Math.floor(Math.random() * alphabet.length);
        letters.push(alphabet[choice]);
      }
      var userId = letters.join('') + time_suffix;

      license.set({ state: "initial", catblockVersion: 1, userId: userId, minutesBetweenChecks: 60 });
      theLicense = storage_get("license");
    }
    return theLicense;
  },

  set: function(theLicense) {
    if (theLicense && theLicense.state) {
      storage_set("license", theLicense);
      if (!SAFARI) {
        var text = (theLicense.state === "enabled" ? "" : "?");
        chrome.browserAction.setBadgeText({text: text});
        chrome.browserAction.setBadgeBackgroundColor({color: [0, 128, 255, 255]});
      }
    }
  },

  // Get the latest license data from the server, and talk to the user if needed.
  update: function() {
    var theLicense = license.get();

    // .state lookup crashes if storage is broken, so we don't hammer the server.
    if (theLicense.state === "initial") {
      var folder = (SAFARI ? "catblock/options/" : "options/");
      var open = window.openTab || window.open;
      open(chrome.extension.getURL(folder + "index.html"));
      return;
    }

    $.getJSON(license.licenseUrl, theLicense, function(response) {
      license.set(response);
    });
  },

  updatePeriodically: function() {
    license.update();

    var delay = license.get().minutesBetweenChecks * 60 * 1000;
    window.setTimeout(license.updatePeriodically, delay);
  },

  licenseUrl: "https://chromeadblock.com/api/catblock-license.php"
};

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  if (request.command === 'get-license') {
    sendResponse(license.get());
  }
  else if (request.command === "set-email") {
    var theLicense = license.get();
    theLicense.email = request.email;
    license.set(theLicense);

    $.getJSON(license.licenseUrl, theLicense, function(response) {
      if (response && response.state) {
        license.set(response);
        sendResponse(response);
      }
    });
  }
});
