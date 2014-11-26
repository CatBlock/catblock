$(function() {
  localizePage();
  
  // Sort the languages list
  var languageOptions = $("#step2_lang option");
  languageOptions.sort(function(a,b) {
    if (!a.text) return -1; if (!b.text) return 1; // First one is empty
    if (!a.value) return 1; if (!b.value) return -1; // 'Other' at the end
    if (a.getAttribute("i18n") == "lang_english") return -1; // English second
    if (b.getAttribute("i18n") == "lang_english") return 1;
    return (a.text > b.text) ? 1 : -1;
  });
  $("#step2_lang").empty().append(languageOptions);
});

//fetching the options...
var options = parseUri.parseSearch(document.location.search);

//get the list of subscribed filters and
//all unsubscribed default filters
var unsubscribed_default_filters = [];
var subscribed_filter_names = [];
BGcall("get_subscriptions_minus_text", function(subs) {
  for (var id in subs)
    if (!subs[id].subscribed && !subs[id].user_submitted)
      unsubscribed_default_filters[id] = subs[id];
    else if (subs[id].subscribed)
      subscribed_filter_names.push(id);
});

var enabled_settings = [];
BGcall("get_settings", function(settings) {
  for (setting in settings)
    if (settings[setting])
      enabled_settings.push(setting);
});

//generate the URL to the issue tracker
function generateReportURL() {
  var result = "http://code.google.com/p/adblockforchrome/issues/entry" +
               "?template=Ad%20report%20from%20user&summary=";

  var domain = "<enter URL of webpage here>";
  if (options.url)
    domain = parseUri(options.url).hostname;
  result = result + encodeURIComponent("Ad report: " + domain);

  var body = [];
  var count = 1;
  body.push("Last step -- point me to the ad so I can fix the bug! " +
      "Don't leave anything out or I'll probably " +
      "have to ignore your report. Thanks!");
  body.push("");
  if (!options.url) {
    body.push(count + ". Paste the URL of the webpage showing an ad: ");
    body.push("");
    body.push("");
    count++;
  }
  body.push(count + ". Exactly where on that page is the ad? What does it " +
      "look like? Attach a screenshot, with the ad clearly marked, " +
      "if you can.");
  body.push("");
  body.push("");
  count++;
  body.push(count + ". Paste a working filter, if you have one: ");
  body.push("");
  body.push("");
  count++;
  body.push(count + ". Any other information that would be helpful, besides " +
      "what is listed below: ");
  body.push("");
  body.push("");
  body.push("-------- Please don't touch below this line. ---------");
  if (options.url) {
    body.push("=== URL with ad ===");
    body.push(options.url);
    body.push("");
  }
  body.push("=== Subscribed filters ===");
  body.push(subscribed_filter_names.join('\n'));
  body.push("");
  body.push("=== Browser" + (AdBlockVersion ? ' & AdBlock' : '') + ": ===");
  body.push(SAFARI ? "Safari " :
    "Google Chrome " + navigator.userAgent.match('Chrome\/([0-9.]+)')[1]);
  if (AdBlockVersion)
    body.push("AdBlock " + AdBlockVersion);
  body.push("");
  body.push("=== Enabled settings ===");
  body.push(enabled_settings.join('\n'));

  result = result + "&comment=" + encodeURIComponent(body.join('\n'));

  return result;
}



// STEP 1: update filters

//Updating the users filters
$("#UpdateFilters").click(function() {
  $(this).attr("disabled", "disabled");
  BGcall("update_subscriptions_now");
});
//if the user clicks a radio button
$("#step1_no").click(function() {
  $("#step1").html("<span class='answer'>" + translate("no") + "</span>");
  $("#whattodo").text(translate("adalreadyblocked"));
});
$("#step1_yes").click(function() {
  $("#step1").html("<span class='answer'>" + translate("yes") + "</span>");
  $("#step2DIV").css("display", "block");
});



// STEP 2: language

//if the user clicks an item
var contact = "";
$("#step2_lang").change(function() {
  var selected = $("#step2_lang option:selected");
  $("#step2").html("<span class='answer'>"+ selected.text() +"</span>");
  if (selected.text() == translate("other")) {
    $("#whattodo").html(translate("nodefaultfilter1",
                                  ["<a href='http://adblockplus.org/en/subscriptions'>", "</a>"]));
    return;
  } else {
    var required_lists = selected.attr('value').split(';');
    for (var i=0; i < required_lists.length - 1; i++) {
      if (unsubscribed_default_filters[required_lists[i]]) {
        $("#whattodo").text(translate("retryaftersubscribe", [translate("filter" + required_lists[i])]));
        return;
      }
    }
  }
  contact = required_lists[required_lists.length-1];
  $("#step3DIV").css("display", "block");

  var hideChromeInChrome = (SAFARI?['','']:['<span style="display:none;">', '</span>']);
  $("#checkinfirefox1").html(translate("checkinfirefox_1", hideChromeInChrome));
  $("#checkinfirefox2").html(translate("checkinfirefox_2", hideChromeInChrome));
  $("#checkinfirefox").html(translate("checkinfirefoxtitle", hideChromeInChrome));
});


// STEP 3: also in Firefox

//If the user clicks a radio button
$("#step3_yes").click(function() {
  $("#step3").html("<span class='answer'>" + translate("yes") + "</span>");
  if (/^mailto\:/.test(contact))
    contact = contact.replace(" at ", "@");
  var reportLink = "<a href='" + contact + "'>" + contact.replace(/^mailto\:/, '') + "</a>";
  $("#whattodo").html(translate("reportfilterlistproblem", [reportLink]));
});
$("#step3_no").click(function() {
  if (SAFARI) {
    // Safari can't block video ads
    $("#step4DIV").css("display", "block");
  } else {
    $("#whattodo").html(translate("reporttous2"));
    $("a", "#whattodo").attr("href", generateReportURL());
  }
  $("#step3").html("<span class='answer'>" + translate("no") + "</span>");
});
$("#step3_wontcheck").click(function() {
  if (!SAFARI) {
    // Chrome blocking is good enough to assume the answer is 'yes'
    $("#step3_yes").click();
  } else {
    // Safari can't do this.
    $("#whattodo").text(translate("fixityourself"));
  }
  $("#step3").html("<span class='answer'>" + translate("refusetocheck") + "</span>");
});



// STEP 4: video/flash ad

//If the user clicks a radio button
$("#step4_yes").click(function() {
  $("#step4").html("<span class='answer'>" + translate("yes") + "</span>");
  $("#whattodo").text(translate("cantblockflash"));
});
$("#step4_no").click(function() {
  $("#step4").html("<span class='answer'>" + translate("no") + "</span>");
  $("#whattodo").html(translate("reporttous2"));
  $("a", "#whattodo").attr("href", generateReportURL());
});



// GENERAL STUFF

//check for updates
var AdBlockVersion;
try {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", chrome.extension.getURL('manifest.json'), false);
  xhr.onreadystatechange = function() {
    if(this.readyState == 4) {
      //get the current version
      AdBlockVersion = JSON.parse(this.responseText).version;
      //check for newer versions
      var checkURL = "http://clients2.google.com/service/update2/crx?" +
          "x=id%3Dgighmmpiobklfepjocnamgkkbiglidom%26v%3D" +
          AdBlockVersion + "%26uc";
      if (SAFARI)
        checkURL = "http://safariadblock.com/update.plist";
      //fetch the version check file
      $.ajax({
        cache: false,
        datatype: (SAFARI ? "text" : "xml"),
        url: checkURL,
        success: function(response) {
          var updateURL;
          if (!SAFARI) {
            updateURL = $("updatecheck[status='ok'][codebase]", response).attr('codebase');
          } else {
            var version = response.match(/\<string\>(\d+\.\d+\.\d+)\<\/string\>/)[1];
            if (isNewerVersion(version)) {
              updateURL = response.match(/http\:\/\/.*\.safariextz/)[0];
            }
          }
          //new version available
          if (updateURL) {
            $("#whattodo").html(translate("updatefromoldversion", ["<a href='" + updateURL + "'>", "</a>"]));
            $("div[id^='step'][id$='DIV']").css('display', 'none');
          }
        }
      });
    }
  };
  xhr.send();
} catch (ex) {}
// Check if newVersion is newer than AdBlockVersion
function isNewerVersion(newVersion) {
  var versionRegex = /^(\d+)\.(\d+)\.(\d+)$/;
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
