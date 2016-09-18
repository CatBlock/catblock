var optionalSettings = {};

function tabLoad() {
    // Click handler for loading tabs
    $("#desktopnav > a, #mobilenav > div > a").click(function(event) {

        // Remove highlight of current tab and
        // highlight tab, which is about to be shown
        $("#desktopnav > a, #mobilenav > div > a").removeClass();
        $(this).addClass("active");

        // Hide the current tab
        $(".options").hide();

        // Get data, what tab and scripts should we load
        var target = event.target;
        var scripts = target.dataset.scripts;
        var page = target.dataset.page;
        var pageName = page.split(".")[0] === "" ? "catblock" : page.split(".")[0];

        // Finally, show the chosen tab
        $("#" + pageName).show();

        // Load requested tab's scripts and localize tab
        scripts.split(" ").forEach(function(scriptToLoad) {
            // CSP blocks eval, which $().append(scriptTag) uses
            var loadedScripts = document.querySelectorAll("script");
            var allowScriptToBeLoaded = true;

            var scriptTagToLoad = document.createElement("script");
            scriptTagToLoad.src = scriptToLoad;

            for (var loadedScript of loadedScripts) {
                if (loadedScript.src === scriptTagToLoad.src) {
                    allowScriptToBeLoaded = false;
                    break;
                }
            }
            // When script hasn't been loaded yes, execute it
            if (allowScriptToBeLoaded) {
                document.getElementById("content").appendChild(scriptTagToLoad);
            }
        });
    });

    // Show general tab by default
    if ($("#toggletabs").is(":visible")) {
        $("#mobilenav > div > a:first-child").click();
    } else {
        $("#desktopnav > a:first-child").click();
    }

    // Display responsive tab options
    $("#toggletabs").click(function() {
        $(this).toggleClass("expanded").siblings("div").slideToggle();
    });
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
    $("#version_number").text("CatBlock " + versionNumber);
}

function displayTranslationCredit() {
    if (determineUserLanguage() !== "en") {
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
        // When init is complete, show the content of the page
        $("body").fadeIn();
    });
});