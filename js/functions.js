// Set to true to get noisier console.log statements
var VERBOSE_DEBUG = false;

// Global variable for browser detection
var OPERA = navigator.userAgent.indexOf("OPR") > -1;
var EDGE = navigator.userAgent.indexOf("Edge") > -1;
var FIREFOX = navigator.userAgent.indexOf("Firefox") > -1;
var CHROME = !OPERA && !EDGE && !FIREFOX && !SAFARI; // SAFARI is defined in port.js

// Edge uses "browser" namespace for its API
if (EDGE) {
    chrome = browser;
}

// Run a function on the background page.
// Inputs (positional):
//   first, a string - the name of the function to call
//   then, any arguments to pass to the function (optional)
//   then, a callback:function(return_value:any) (optional)
function BGcall() {
    var args = [];
    for (var i=0; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
    var fn = args.shift();
    var has_callback = (typeof args[args.length - 1] === "function");
    var callback = (has_callback ? args.pop() : function() {});
    chrome.runtime.sendMessage({ command: "call", fn:fn, args:args }, callback);
}

// Enabled in adblock_start_common.js and background.js if the user wants
var log = function() {};

function logging(enabled) {
    if (enabled) {
        log = function() {
            if (VERBOSE_DEBUG || arguments[0] !== "[DEBUG]") { // comment out for verbosity
                console.log.apply(console, arguments);
            }
        };
    } else {
        log = function() {};
    }
}
logging(false); // disabled by default

// Behaves very similarly to $.ready() but does not require jQuery.
function onReady(callback) {
    if (document.readyState === "complete") {
        window.setTimeout(callback, 0);
    } else {
        window.addEventListener("load", callback, false);
    }
}

function translate(messageID, args) {
    return chrome.i18n.getMessage(messageID, args);
}

// Determine what language the user's browser is set to use
function determineUserLanguage() {
    return navigator.language.match(/^[a-z]+/i)[0];
}

function localizePage() {
    // Translate a page into the users language
    $("[i18n]:not(.i18n-replaced)").each(function() {
        try {
            $(this).html(translate($(this).attr("i18n")));
        } catch(e) {
            console.log(e);
        }
    });
    $("[i18n_value]:not(.i18n-replaced)").each(function() {
        $(this).val(translate($(this).attr("i18n_value")));
    });
    $("[i18n_title]:not(.i18n-replaced)").each(function() {
        $(this).attr("title", translate($(this).attr("i18n_title")));
    });
    $("[i18n_placeholder]:not(.i18n-replaced)").each(function() {
        $(this).attr("placeholder", translate($(this).attr("i18n_placeholder")));
    });
    $("[i18n_replacement_el]:not(.i18n-replaced)").each(function() {
        // Replace a dummy <a/> inside of localized text with a real element.
        // Give the real element the same text as the dummy link.
        var dummy_link = $("a", this);
        var text = dummy_link.text();
        var real_el = $("#" + $(this).attr("i18n_replacement_el"));
        real_el.text(text).val(text).replaceAll(dummy_link);
        // If localizePage is run again, don't let the [i18n] code above
        // clobber our work
        $(this).addClass("i18n-replaced");
    });

    // Make a right-to-left translation for Arabic and Hebrew languages
    var language = determineUserLanguage();
    if (language === "ar" || language === "he") {
        $("#main_nav").removeClass("right").addClass("left");
        $(".adblock-logo").removeClass("left").addClass("right");
        $(".closelegend").css("float","left");
        document.documentElement.dir = "rtl";
    }
}

// Parse an URL.
// The difference between URL constructor and parseURI constructor
// is that parseURI constructor allows us to store Unicode-encoded URIs.
// Inputs: url: the URL you want to parse
// Outputs: object containing all parts of |url| as attributes
class parseURI {
    constructor(url) {
        // Pass given |url| to the URL constructor
        var originURL = new URL(url);

        // Create an object, in which we'll store
        // href/origin/host/hostname in Unicode encoding
        var parsedURL = {};

        // Convert following values from punycode to Unicode
        parsedURL.href = punycode.toUnicode(originURL.href);
        parsedURL.origin = punycode.toUnicode(originURL.origin);
        parsedURL.host = punycode.toUnicode(originURL.host);
        parsedURL.hostname = punycode.toUnicode(originURL.hostname);

        // Push every key/value from |originURL| to our |parsedURL| object
        // except of href/origin/host/hostname, which we already have included
        for (var key in originURL) {
            if (key === "href" || key === "origin" || key === "host" || key === "hostname") {
                continue;
            }
            parsedURL[key] = originURL[key];
        }

        // Delete unneeded toString() method
        delete parsedURL.toString;

        return parsedURL;
    }

    // Returns punycode domain encoded in Unicode
    static getUnicodeDomain(domain) {
        return punycode.toUnicode(domain);
    }

    // Parses the search part of a URL into a key: value object.
    // e.g., ?hello=world&ext=adblock would become {hello:"world", ext:"adblock"}
    // Inputs: search: the search query of a URL. Must have &-separated values.
    static parseSearch(search) {
        // Fails if a key exists twice (e.g., ?a=foo&a=bar would return {a:"bar"}
        search = search.substring(search.indexOf("?") + 1).split("&");
        var params = {}, pair;
        for (var i = 0; i < search.length; i++) {
            pair = search[i].split("=");
            if (pair[0] && !pair[1]) {
                pair[1] = "";
            }
            if (!params[decodeURIComponent(pair[0])] && decodeURIComponent(pair[1]) === "undefined") {
                continue;
            } else {
                params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
            }
        }
        return params;
    }

    // Strip third+ level domain names from the domain and return the result.
    // Inputs: domain: the domain that should be parsed
    //         keepDot: true if trailing dots should be preserved in the domain
    // Returns: the parsed domain
    static secondLevelDomainOnly(domain, keepDot) {
        if (domain) {
            var match = domain.match(/([^\.]+\.(?:co\.)?[^\.]+)\.?$/) || [domain, domain];
            return match[keepDot ? 0 : 1].toLowerCase();
        }
        return domain;
    }
}

// TODO: move back into background.js since Safari can't use this
// anywhere but in the background.  Do it after merging 6101 and 6238
// and 5912 to avoid merge conflicts.
// Inputs: key:string.
// Returns value if key exists, else undefined.
function storage_get(key) {
    var store = (window.SAFARI ? safari.extension.settings : localStorage);
    if (store === undefined) {
        return undefined;
    }
    var json = store.getItem(key);
    if (json === null) {
        return undefined;
    }
    try {
        return JSON.parse(json);
    } catch (e) {
        log("Couldn't parse json for " + key);
        return undefined;
    }
}

// Inputs: key:string, value:object.
// If value === undefined, removes key from storage.
// Returns undefined.
function storage_set(key, value) {
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
        if (ex.name === "QUOTA_EXCEEDED_ERR" && !SAFARI) {
            alert(translate("catblock_storage_quota_exceeded"));
            openTab("options/index.html#ui-tabs-2");
        }
    }
}

// Return obj[value], first setting it to |defaultValue| if it is undefined.
function setDefault(obj, value, defaultValue) {
    if (obj[value] === undefined) {
        obj[value] = defaultValue;
    }
    return obj[value];
}

// Inputs: key:string.
// Returns value if key exists, else undefined.
function sessionstorage_get(key) {
    var json = sessionStorage.getItem(key);
    if (json === null) {
        return undefined;
    }
    try {
        return JSON.parse(json);
    } catch (e) {
        log("Couldn't parse json for " + key);
        return undefined;
    }
}

// Inputs: key:string.
// Returns value if key exists, else undefined.
function sessionstorage_set(key, value) {
    if (value === undefined) {
        sessionStorage.removeItem(key);
        return;
    }
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch (ex) {
        if (ex.name === "QUOTA_EXCEEDED_ERR" && !SAFARI) {
            alert(translate("catblock_storage_quota_exceeded"));
            openTab("options/index.html#ui-tabs-2");
        }
    }
}

// Create a user notification on Safari
//
function createRuleLimitExceededSafariNotification() {
    if (SAFARI && ("Notification" in window)) {
        sessionstorage_set("contentblockingerror", translate("safaricontentblockinglimitexceeded"));
        chrome.runtime.sendMessage({command: "contentblockingmessageupdated"});
        var note = new Notification(translate("safarinotificationtitle"),
                                    { "body" : translate("catblock_safarinotificationbody"), "tag" : 1 });
        note.onclick = function() {
            openTab("options/index.html?tab=0");
        };
    }
}