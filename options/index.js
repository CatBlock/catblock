var optionalSettings = {};

function tabLoad() {
    // An event handler, which loads tabs
    $("nav.desktop > a, nav.mobile > div > a").click(function(event) {

        // Highlight the name of a tab, which is about to be shown
        $("nav.desktop > a, nav.mobile > div > a").removeClass();
        $(this).addClass("active");

        // Hide the current tab
        $(".options").hide();

        // Get data: what tab should we show
        //           what scripts should we execute
        var target = event.target;
        var scripts = target.dataset.scripts;
        var pageName = target.dataset.page;

        // Add a class which is different to the content of the tab
        $("#content").removeClass();
        $("#content").addClass(pageName);

        // Finally, show the tab we want
        $("#" + pageName).show();

        // Load requested tab's scripts and localize tab
        scripts.split(" ").forEach(function(scriptToLoad) {
            // CSP blocks eval, which $().append(scriptTag) uses
            // Don't load a script, which has already been executed
            var loadedScripts = document.querySelectorAll("script");
            var allowScriptToBeLoaded = true;
            for (var loadedScript of loadedScripts) {
                if (loadedScript.src === chrome.runtime.getURL(scriptToLoad)) {
                    allowScriptToBeLoaded = false;
                    break;
                }
            }
            if (allowScriptToBeLoaded) {
                var s = document.createElement("script");
                s.src = scriptToLoad;
                document.getElementById("content").appendChild(s);
            }
        });
    });

    // Display responsive tab menu
    $("#toggletabs").click(function() {
        $(this).toggleClass("expanded").siblings("div").slideToggle();
    });

    // Show general tab by default
    if ($("#toggletabs").is(":visible")) {
        $("nav.mobile > div > a:first-child").click();
    } else {
        $("nav.desktop > a:first-child").click();
    }
}

function afterTabLoad() {
    // Hide advanced settings
    if (optionalSettings && !optionalSettings.show_advanced_options) {
        $(".advanced").hide();
    }
    if (SAFARI) {
        $(".chrome-only").hide();
    } else {
        $(".safari-only").hide();
    }
    localizePage();
}

function displayVersionNumber() {
    var versionNumber = chrome.runtime.getManifest().version;
    $("#version_number").text(translate("optionsversion", [versionNumber]));
}

function displayTranslationCredit() {
    if (navigator.language.substring(0, 2) !== "en") {
        var translators = [];
        var xhr = new XMLHttpRequest();
        xhr.open("GET", chrome.runtime.getURL("translators.json"), true);
        xhr.overrideMimeType("application/json");
        xhr.onload = function() {
            var text = JSON.parse(this.responseText);
            var lang = navigator.language;
            for (var id in text) {
                if (!SAFARI) {
                    if (id === lang) {
                        for (var translator in text[id].translators) {
                            var name = text[id].translators[translator].credit;
                            translators.push(" " + name);
                        }
                    } else {
                        for (var translator in text[id].translators) {
                            var lang = lang.toLowerCase();
                            if (id === lang) {
                                var name = text[lang].translators[translator].credit;
                                translators.push(" " + name);
                            }
                        }
                    }
                } else {
                    if (lang.substring(0, 2) === id) {
                        for (var translator in text[id].translators) {
                            var name = text[id].translators[translator].credit;
                            translators.push(" " + name);
                        }
                    } else {
                        for (var translator in text[id].translators) {
                            if (id === lang) {
                                var name = text[lang].translators[translator].credit;
                                translators.push(" " + name);
                            }
                        }
                    }
                }
            }
            $("#translator_credit").text(translate("translator_credit"));
            $("#translator_names").text(translators.toString());
        };
        xhr.send();
    }
}

$(document).ready(function() {
    BGcall("get_settings", function(settings) {
        optionalSettings = settings;
        tabLoad();
        afterTabLoad();
        displayVersionNumber();
        displayTranslationCredit();
    });
});