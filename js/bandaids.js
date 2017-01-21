// Youtube-related code in this file based on © Adblock Plus™ code licensed under GPLv3.
function run_bandaids() {
    // Tests to determine whether a particular bandaid should be applied
    var apply_bandaid_for = "";
    if (/facebook\.com/.test(document.location.hostname)) {
        apply_bandaid_for = "facebook";
    } else if (/mail\.live\.com/.test(document.location.hostname)) {
        apply_bandaid_for = "hotmail";
    } else if (/mobilmania\.cz|zive\.cz|doupe\.cz|e15\.cz|sportrevue\.cz|autorevue\.cz/.test(document.location.hostname)) {
        apply_bandaid_for = "czech_sites";
    } else {
        var hosts = [/mastertoons\.com$/];
        hosts = hosts.filter(function(host) { return host.test(document.location.hostname); });
        if (hosts.length > 0) {
            apply_bandaid_for = "noblock";
        }
    }
    var bandaids = {
        noblock: function() {
            var styles = document.querySelectorAll("style");
            var re = /#(\w+)\s*~\s*\*\s*{[^}]*display\s*:\s*none/;
            for (var i = 0; i < styles.length; i++) {
                var id = styles[i].innerText.match(re);
                if (id) {
                    styles[i].innerText = "#" + id[1] + " { display: none }";
                }
            }
        },
        hotmail: function() {
            //removing the space remaining in Hotmail/WLMail
            var css_chunk = document.createElement("style");
            css_chunk.type = "text/css";
            (document.head || document.documentElement).insertBefore(css_chunk, null);
            css_chunk.sheet.insertRule(".WithRightRail { right: 0 !important; }", 0);
            css_chunk.sheet.insertRule("#RightRailContainer  { display: none !important; visibility: hidden !important; orphans: 4321 !important; }" , 0);
        },
        czech_sites: function() {
            var player = document.getElementsByClassName("flowplayer");
            // Remove data-ad attribute from videoplayer
            if (player) {
                for (var i=0; i<player.length; i++) {
                    player[i].removeAttribute("data-ad");
                }
            }
        },
        facebook: function() {
            // Block sidebar ads
            var css_chunk = document.createElement("style");
            css_chunk.type = "text/css";
            (document.head || document.documentElement).insertBefore(css_chunk, null);
            css_chunk.sheet.insertRule("#pagelet_ego_pane .uiHeader.uiHeaderTopBorder.mbs.uiSideHeader, #pagelet_ego_pane .ego_unit { display:none !important; visibility: hidden !important; orphans: 4321 !important; }", 0);

            // Block news-feed ads
            // The following code is based on:
            // https://greasyfork.org/en/scripts/22210-facebook-unsponsored
            var streamSelector = "div[id^='topnews_main_stream']";
            var storySelector = "div[id^='hyperfeed_story_id']";
            var sponsoredSelectors = [
                "a[href^='https://www.facebook.com/about/ads']",
                "a[href^='https://www.facebook.com/ads/about']",
                "a[href^='/about/ads']",
                "a[href^='https://i.facebook.com/']",
                "a[href*='hc_ref=ADS']",
                "a[href^='/ads/about']"
            ];

            var suggestedPhrases = [
                "Popular Live Video",
                "Suggested Post"
            ];

            var stream;
            var mutationObserver = window.MutationObserver || window.WebKitMutationObserver;

            function block(story) {
                if (!story) {
                    return;
                }
                story.remove();
            }

            function check(story) {
                if (!story) {
                    return;
                }

                var sponsored = false;
                var i;
                for (i=0; i < sponsoredSelectors.length; i++) {
                    if (story.querySelectorAll(sponsoredSelectors[i]).length) {
                        sponsored = true;
                        break;
                    }
                }

                var divs = [];
                var j;
                if (!sponsored) {
                    divs = story.querySelectorAll(".userContentWrapper > div > div");
                    for (i=0; i < divs.length; i++) {
                        for (j=0; j < suggestedPhrases.length; j++) {
                            if (divs[i].innerText.trim() === suggestedPhrases[j]) {
                                sponsored = true;
                                break;
                            }
                        }

                        if (sponsored) {
                            break;
                        }
                    }
                }

                if (sponsored) {
                    block(story);
                }
            }

            function process() {
                // Locate the stream every iteration to allow for FB SPA navigation which
                // replaces the stream element
                stream = document.querySelector(streamSelector);
                if (!stream) {
                    return;
                }

                var stories = stream.querySelectorAll(storySelector);
                if (!stories.length) {
                    return;
                }

                var i;
                for (i=0; i < stories.length; i++) {
                    check(stories[i]);
                }
            }

            var observer = new mutationObserver(process);
            observer.observe(document.querySelector("body"), {
                "childList": true,
                "subtree": true
            });
        }
    }; // end bandaids

    if (apply_bandaid_for) {
        log("Running bandaid for " + apply_bandaid_for);
        bandaids[apply_bandaid_for]();
    }

}


function before_ready_bandaids() {

}

// Safari & YouTube only
// This function is outside the normal 'bandaids' processing
// so that it works correctly
(function() {
    if ((typeof SAFARI) !== "undefined" &&
        SAFARI &&
        document.domain === "www.youtube.com") {
        //continue
    } else {
        return;
    }

    // a regex used to test the ytplayer config / flashvars for youtube ads, references to ads, etc.
    var badArgumentsRegex = /^((.*_)?(ad|ads|afv|adsense)(_.*)?|(ad3|st)_module|prerolls|interstitial|infringe|iv_cta_url)$/;

    function rewriteFlashvars(flashvars) {
        var pairs = flashvars.split("&");
        for (var i = 0; i < pairs.length; i++) {
            if (badArgumentsRegex.test(pairs[i].split("=")[0])) {
                pairs.splice(i--, 1);
            }
        }
        return pairs.join("&");
    }

    function patchPlayer(player) {
        var newPlayer = player.cloneNode(true);
        var flashvarsChanged = false;

        var flashvars = newPlayer.getAttribute("flashvars");
        if (flashvars) {
            var newFlashvars = rewriteFlashvars(flashvars);
            if (flashvars !== newFlashvars) {
                newPlayer.setAttribute("flashvars", newFlashvars);
                flashvarsChanged = true;
            }
        }

        var param = newPlayer.querySelector("param[name=flashvars]");
        if (param) {
            var value = param.getAttribute("value");
            if (value) {
                var newValue = rewriteFlashvars(value);
                if (value !== newValue) {
                    param.setAttribute("value", newValue);
                    flashvarsChanged = true;
                }
            }
        }

        if (flashvarsChanged) {
            player.parentNode.replaceChild(newPlayer, player);
        }
    }

    function runInPage(fn, arg) {
        var script = document.createElement("script");
        script.type = "application/javascript";
        script.async = false;
        script.textContent = "(" + fn + ")(" + arg + ");";
        document.documentElement.appendChild(script);
        document.documentElement.removeChild(script);
    }

    document.addEventListener("beforeload", function(event) {
        if ((event.target.localName === "object" || event.target.localName === "embed") && /:\/\/[^\/]*\.ytimg\.com\//.test(event.url)) {
            patchPlayer(event.target);
        }
    }, true);

    runInPage(function(badArgumentsRegex) {
        // If history.pushState is available, YouTube uses the history API
        // when navigation from one video to another, and tells the flash
        // player with JavaScript which video and which ads to show next,
        // bypassing our flashvars rewrite code. So we disable
        // history.pushState before YouTube's JavaScript runs.
        History.prototype.pushState = undefined;

        // The HTML5 player is configured via ytplayer.config.args. We have
        // to make sure that ad-related arguments are ignored as they are set.
        var ytplayer = undefined;
        Object.defineProperty(window, "ytplayer", {
            configurable: true,
            get: function() {
                return ytplayer;
            },
            set: function(rawYtplayer) {
                if (!rawYtplayer || typeof rawYtplayer !== "object") {
                    ytplayer = rawYtplayer;
                    return;
                }

                var config = undefined;
                ytplayer = Object.create(rawYtplayer, {
                    config: {
                        enumerable: true,
                        get: function() {
                            return config;
                        },
                        set: function(rawConfig) {
                            if (!rawConfig || typeof rawConfig !== "object") {
                                config = rawConfig;
                                return;
                            }

                            var args = undefined;
                            config = Object.create(rawConfig, {
                                args: {
                                    enumerable: true,
                                    get: function() {
                                        return args;
                                    },
                                    set: function(rawArgs) {
                                        if (!rawArgs || typeof rawArgs !== "object") {
                                            args = rawArgs;
                                            return;
                                        }

                                        args = {};
                                        for (var arg in rawArgs) {
                                            if (rawArgs.hasOwnProperty(arg)) {
                                                if (!badArgumentsRegex.test(arg)) {
                                                    args[arg] = rawArgs[arg];
                                                }
                                            }
                                        }
                                    }
                                }
                            });

                            config.args = rawConfig.args;
                        }
                    }
                });

                ytplayer.config = rawYtplayer.config;
            }
        });
    }, badArgumentsRegex);//end of runInPage()
})();
