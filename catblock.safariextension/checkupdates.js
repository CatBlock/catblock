//Check for updates
function checkupdates(page) {
  var AdBlockVersion;
  $.ajax({
    url: chrome.extension.getURL('manifest.json'),
    dataType: "json",
    success: function(json) {
      AdBlockVersion = json.version;
      var checkURL = (SAFARI ? "https://safariadblock.com/update.plist" :
            "https://clients2.google.com/service/update2/crx?" +
            "x=id%3Dgighmmpiobklfepjocnamgkkbiglidom%26v%3D" +
            AdBlockVersion + "%26uc");

      //fetch the version check file
      $.ajax({
        cache: false,
        dataType: "xml",
        url: checkURL,
        error: function() {
          if (page === "help") {
            $("#checkupdate").html(translate("somethingwentwrong")).show();
          } else {
            $("#checkupdate").html(translate("checkinternetconnection")).show();
          }
        },
        success: function(response) {
          if (!SAFARI) {
            if ($("updatecheck[status='ok'][codebase]", response).length) {
              $("#checkupdate").html(translate("adblock_outdated_chrome")).show().
                find("a").click(function() {
                 if (OPERA) {
                   chrome.tabs.create({url: 'opera://extensions/'});
                 } else {
                   chrome.tabs.create({url: 'chrome://extensions/'});
                 }
                });
                $(".step").hide();
            } else {
              if (page === "help") {
                $("#checkupdate").html(translate("latest_version")).show();
              }
            }
          } else {
            var version = $("key:contains(CFBundleShortVersionString) + string",response).text();
            if (isNewerVersion(version)) {
              $("#checkupdate").html(translate("update_available"));
              var updateURL = $("key:contains(URL) + string", response).text();
              $("#here").html(translate("here")).attr("href", updateURL);
              $(".step").hide();
            } else {
              if (page === "help") {
                $("#checkupdate").html(translate("latest_version")).show();
              }
            }
          }
        }
      });
    }
  });

  // Hide ad-reporting wizard, when user is offline
  if (page === "adreport" && $('#checkupdate').is(':visible')) {
    $('.section').hide();
  }

  // Check if newVersion is newer than AdBlockVersion
  function isNewerVersion(newVersion) {
    var versionRegex = /^(\*|\d+(\.\d+){0,2}(\.\*)?)$/;
    var current = AdBlockVersion.match(versionRegex);
    var notCurrent = newVersion.match(versionRegex);
    if (!current || !notCurrent)
      return false;
    for (var i=1; i<4; i++) {
      if (current[i] < notCurrent[i])
        return true;
      if (current[i] > notCurrent[i])
        return false;
    }
    return false;
  }
};