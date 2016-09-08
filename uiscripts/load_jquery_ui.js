//Binds keypress enter to trigger click action on
//default button or trigger click action on focused
//button.
function bind_enter_click_to_default() {
    if (window.GLOBAL_ran_bind_enter_click_to_default) {
        return;
    }
    GLOBAL_ran_bind_enter_click_to_default = true;
    $("html").on("keypress", function(e) {
        if (e.keyCode === 13 && $("button:focus").size() <= 0) {
            e.preventDefault();
            $(".adblock_default_button").filter(":visible").click();
        }
    });
}

function load_jquery_ui(callback) {
    function load_css(src) {
        var url = chrome.runtime.getURL(src);
        var link = $("<link rel='stylesheet' type='text/css' />").
        attr("href", url).
        addClass("adblock-ui-stylesheet");
        $(document.head || document.documentElement).append(link);
    }
    load_css("jquery/css/jquery-ui.custom.css");
    load_css("jquery/css/override-page.css");

    if (!SAFARI) {
        // Chrome already loaded jQueryUI via executeScript
        callback();
    }
    else {
        BGcall("injectjQueryUI", function() {
            BGcall("get_l10n_data", function(data) {
                chrome.i18n._setL10nData(data);
                callback();
            });
        });
    }
}

// Set RTL for Arabic and Hebrew users in blacklist and whitelist wizards
var text_direction = (function() {
    var language = navigator.language.match(/^[a-z]+/i)[0];
    return language === "ar" || language === "he" ? "rtl": "ltr";
})();

function changeTextDirection($selector) {
    $selector.attr("dir", text_direction);
    if (text_direction === "rtl") {
        $(".ui-dialog .ui-dialog-buttonpane .ui-dialog-buttonset").css("float", "left");
        $(".ui-dialog .ui-dialog-title").css("float", "right");
        $(".ui-dialog .ui-dialog-titlebar").css("background-position", "right center");
        $(".ui-dialog .ui-dialog-titlebar-close").css({ left: "0.3em", right: "initial" });
    }
}