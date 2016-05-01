function tabLoad() {
    // Load different tabs
    $("nav > a, nav > div > a").click(function(event) {
        $("nav > a, nav > div > a").removeClass(); // remove "active" class
        $(this).addClass("active");
        // Hide current tab
        $('.options').hide();
        // Remove dynamically created filter lists entries
        $('#ad_blocking_list').children().remove();
        $('#other_filter_lists').children().remove();
        $('#language_list').children().remove();
        var target = event.target;
        var scripts = target.dataset.scripts;
        var page = target.dataset.page;
        var pageName = page.split(".")[0] === "" ? "catblock" : page.split(".")[0];
        // Add a class which is different to the content of the tab
        $("#content").removeClass();
        $("#content").addClass(pageName);
        // Show a tab we want to display
        $("#" + pageName).show();
        // Load requested tab's scripts and localize tab
        scripts.split(" ").forEach(function(scriptToLoad) {
            // CSP blocks eval, which $().append(scriptTag) uses
            var s = document.createElement("script");
            s.src = scriptToLoad;
            document.getElementById("content").appendChild(s);
        });
    });

    // Show general tab
    if ($("#toggletabs").is(":visible")) {
        $("nav > div > a:first-child").click();
        $('.options').hide();
        $('#general').show();
    } else {
        $("nav > a:first-child").click();
        $('.options').hide();
        $('#general').show();
    }

    // Display responsive tab options
    $("#toggletabs").click(function() {
        $(this).toggleClass('expanded').siblings('div').slideToggle();
    });
}

function afterTabLoad() {
    // Hide advanced settings
    if (!optionalSettings.show_advanced_options) {
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
    // TODO: Port getManifest to Safari
    var versionNumber = chrome.runtime.getManifest().version;
    $("#version_number").text(translate("optionsversion", [versionNumber]));
}

function displayTranslationCredit() {
    if (navigator.language.substring(0, 2) != "en") {
        var translators = [];
        var xhr = new XMLHttpRequest();
        xhr.open("GET", chrome.extension.getURL('translators.json'), true);
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

var optionalSettings = {};

$(document).ready(function(){
    BGcall("get_settings", function(settings) {
        optionalSettings = settings;
        tabLoad();
        afterTabLoad();
        displayVersionNumber();
        displayTranslationCredit();
    });
});
