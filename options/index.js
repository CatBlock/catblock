function loadTab() {
    // Load different tabs
    $("nav > a").click(function(event) {
        $("nav > a").removeClass(); // remove "active" class
        $(this).addClass("active");
        var target = event.target;
        var scripts = target.dataset.scripts;
        var page = target.dataset.page;
        var pageName = page.split(".")[0] === "" ? "catblock" : page.split(".")[0];
        // Add a class which is different to the content of the tab
        $("#content").removeClass();
        $("#content").addClass(pageName);
        // Load requested tab and localize it
        $("#content").load(page, afterLoad);
        scripts.split(" ").forEach(function(scriptToLoad) {
            // CSP blocks eval, which $().append(scriptTag) uses
            var s = document.createElement("script");
            s.src = scriptToLoad;
            document.getElementById("content").appendChild(s);
        });
    });

    $("nav > a:first-child").click(); // Show General tab
}

function afterLoad() {
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

var language = navigator.language.match(/^[a-z]+/i)[0];
function rightToLeft() {
    if (language === "ar" || language === "he" ) {
        $(window).resize(function() {
            if ($(".social").is(":hidden")) {
                $("#translation_credits").css({margin: "0px 50%", width: "350px"});
                $("#paymentlink").css({margin: "0px 50%", width: "350px"});
                $("#version_number").css({margin: "20px 50%", width: "350px"});
            } else {
                $("#translation_credits").css("right", "0px");
                $("#paymentlink").css("right", "0px");
                $("#version_number").css({right: "0px", padding: "0px"});
            }
        });
        $("li").css("float","right");
        $("#small_nav").css({right: "initial", left: "45px"});
        $(".ui-tabs .ui-tabs-nav li").css("float", "right");
    } else {
        $(".ui-tabs .ui-tabs-nav li").css("float", "left");
    }
}

function showMiniMenu() {
    $("#small_nav").click(function() {
        if ($(".ui-tabs-nav").is(":hidden")) {
            $(".ui-tabs .ui-tabs-nav li").css("float", "none");
            $(".ui-tabs-nav").fadeIn("fast");
            if (language === "ar" || language === "he" ) {
                $(".ui-tabs-nav").css({right:"auto", left:"40px"});
            }
        } else
            $(".ui-tabs-nav").fadeOut("fast");
    });
    $(window).resize(function() {
        if ($(".ui-tabs-nav").is(":hidden") && $("#small_nav").is(":hidden")) {
            if (language === "ar" || language === "he" ) {
                $(".ui-tabs .ui-tabs-nav li").css("float", "right");
                $(".ui-tabs-nav").css({right:"auto", left:"auto"});
            } else {
                $(".ui-tabs .ui-tabs-nav li").css("float", "left");
            }
            $(".ui-tabs-nav").show();
        } else if ($("#small_nav").is(":visible"))
            $(".ui-tabs-nav").hide();
    });
}

function displayVersionNumber() {
    try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", chrome.extension.getURL('manifest.json'), true);
        xhr.onreadystatechange = function() {
            if(this.readyState == 4) {
                var theManifest = JSON.parse(this.responseText);
                $("#version_number").text(translate("optionsversion", [theManifest.version]));
            }
        };
        xhr.send();
    } catch (ex) {} // silently fail
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
        afterLoad();
        loadTab();
        rightToLeft();
        showMiniMenu();
        displayVersionNumber();
        displayTranslationCredit();
    });
});
