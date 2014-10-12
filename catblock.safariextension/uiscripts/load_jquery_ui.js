function load_jquery_ui(callback) {
  if (typeof global_have_loaded_jquery_ui != "undefined") {
    callback();
    return; // don't inject stylesheets more than once
  }
  global_have_loaded_jquery_ui = true;

  function load_css(src) {
    var url = chrome.extension.getURL(src);
    var link = $('<link rel="stylesheet" type="text/css" />').
      attr('href', url);
    $("head").append(link);
  }
  load_css("jquery/css/custom-theme/jquery-ui-1.8.custom.css");
  load_css("jquery/css/override-page.css");

  if (!SAFARI) {
    // Chrome already loaded jQueryUI via executeScript
    callback();
  }
  else {
    BGcall('readfile', "jquery/jquery-ui.custom.min.js", function(result) {
      eval(result); // suck it, Trebek

      // chrome.i18n.getMessage() lazily loads a file from disk using xhr,
      // but the page itself doesn't have access to extension resources.
      // Since we'll be using getMessage(), we have to ask the background
      // page for the data.
      BGcall('get_l10n_data', function(data) {
        chrome.i18n._setL10nData(data);
        callback();
      });
    });
  }
}

//@ sourceURL=/uiscripts/load_jquery_ui.js
