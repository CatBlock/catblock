// Youtube-related code in this file based on code (c) Adblock Plus. GPLv3.
// and https://hg.adblockplus.org/adblockpluschrome/file/aed8fd38e824/safari/include.youtube.js
var run_bandaids = function() {
  // Tests to determine whether a particular bandaid should be applied
  var apply_bandaid_for = "";
  if (/mail\.live\.com/.test(document.location.hostname))
    apply_bandaid_for = "hotmail";
  else if (/getadblock\.com$/.test(document.location.hostname) &&
           window.top === window.self)
    apply_bandaid_for = "getadblock";
  else if (/mobilmania\.cz|zive\.cz|doupe\.cz|e15\.cz|sportrevue\.cz|autorevue\.cz/.test(document.location.hostname))
    apply_bandaid_for = "czech_sites";
  else if (/thepiratebay/.test(document.location.hostname))
    apply_bandaid_for = "the_pirate_bay_safari_only";
  else {
    var hosts = [ /mastertoons\.com$/ ];
    hosts = hosts.filter(function(host) { return host.test(document.location.hostname); });
    if (hosts.length > 0)
      apply_bandaid_for = "noblock";
  }

  var bandaids = {
    noblock: function() {
      var styles = document.querySelectorAll("style");
      var re = /#(\w+)\s*~\s*\*\s*{[^}]*display\s*:\s*none/;
      for (var i = 0; i < styles.length; i++) {
        var id = styles[i].innerText.match(re);
        if(id) {
          styles[i].innerText = '#' + id[1] + ' { display: none }';
        }
      }
    },
    hotmail: function() {
      //removing the space remaining in Hotmail/WLMail
      el = document.querySelector(".Unmanaged .WithSkyscraper #MainContent");
      if (el) {el.style.setProperty("margin-right", "1px", null);}
      el = document.querySelector(".Managed .WithSkyscraper #MainContent");
      if (el) {el.style.setProperty("right", "1px", null);}
      el = document.getElementById("SkyscraperContent");
      if (el) {
        el.style.setProperty("display", "none", null);
        el.style.setProperty("position", "absolute", null);
        el.style.setProperty("right", "0px", null);
      }
    },
    getadblock: function() {
      BGcall('get_adblock_user_id', function(adblock_user_id) {
        var elemDiv = document.createElement("div");
        elemDiv.id = "adblock_user_id";
        elemDiv.innerText = adblock_user_id;
        elemDiv.style.display = "none";
        document.body.appendChild(elemDiv);
      });
      BGcall('get_first_run', function(first_run) {
        var elemDiv = document.createElement("div");
        elemDiv.id = "adblock_first_run_id";
        elemDiv.innerText = first_run;
        elemDiv.style.display = "none";
        document.body.appendChild(elemDiv);
      });
      BGcall('set_first_run_to_false', null);
      if (document.getElementById("enable_show_survey")) {
        document.getElementById("enable_show_survey").onclick = function(event) {
            BGcall("set_setting", "show_survey", !document.getElementById("enable_show_survey").checked, true);
         };
      }
    },
    czech_sites: function() {
      var player = document.getElementsByClassName("flowplayer");
      // Remove data-ad attribute from videoplayer
      if (player) {
        for (var i=0; i<player.length; i++)
          player[i].removeAttribute("data-ad");
      }
    },
    the_pirate_bay_safari_only: function() {
      // Set cookie to prevent pop-ups from The Pirate Bay
      document.cookie="tpbpop=1%7CSun%2C%2030%20Aug%202024%2006%3A21%3A49%20GMT; expires=Thu, 30 Aug 2034 12:00:00 GMT; path=/;";
    },
  }; // end bandaids

  if (apply_bandaid_for) {
    log("Running bandaid for " + apply_bandaid_for);
    bandaids[apply_bandaid_for]();
  }

};


var before_ready_bandaids = function() {

};

//Safari & YouTube only
//This function is outside the normal 'bandaids' processing
//so that it works correctly
(function() {
    if ((typeof SAFARI) !== 'undefined' &&
         SAFARI &&
         document.domain === "www.youtube.com") {
       //continue
    } else {
       return;
    }

    BGcall('is_adblock_paused', function(paused) {
        if (paused) {
            return;
        }
        //a regex used to test the ytplayer config / flashvars for youtube ads, references to ads, etc.
        var badArgumentsRegex = /^((.*_)?(ad|ads|afv|adsense)(_.*)?|(ad3|st)_module|prerolls|interstitial|infringe|iv_cta_url)$/;

        function rewriteFlashvars(flashvars) {
            var pairs = flashvars.split("&");
            for (var i = 0; i < pairs.length; i++)
                if (badArgumentsRegex.test(pairs[i].split("=")[0]))
                    pairs.splice(i--, 1);
            return pairs.join("&");
        }

        function patchPlayer(player) {
            var newPlayer = player.cloneNode(true);
            var flashvarsChanged = false;

            var flashvars = newPlayer.getAttribute("flashvars");
            if (flashvars) {
                var newFlashvars = rewriteFlashvars(flashvars);
                if (flashvars != newFlashvars) {
                    newPlayer.setAttribute("flashvars", newFlashvars);
                    flashvarsChanged = true;
                }
            }

            var param = newPlayer.querySelector("param[name=flashvars]");
            if (param) {
                var value = param.getAttribute("value");
                if (value) {
                    var newValue = rewriteFlashvars(value);
                    if (value != newValue) {
                        param.setAttribute("value", newValue);
                        flashvarsChanged = true;
                    }
                }
            }

            if (flashvarsChanged)
                player.parentNode.replaceChild(newPlayer, player);
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
            if ((event.target.localName == "object" || event.target.localName == "embed") && /:\/\/[^\/]*\.ytimg\.com\//.test(event.url))
                patchPlayer(event.target);
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
                if (!rawYtplayer || typeof rawYtplayer != "object") {
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
                      if (!rawConfig || typeof rawConfig != "object") {
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
                            if (!rawArgs || typeof rawArgs != "object") {
                              args = rawArgs;
                              return;
                            }

                            args = {};
                            for (var arg in rawArgs) {
                              if (!badArgumentsRegex.test(arg))
                                args[arg] = rawArgs[arg];
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
      });//end of BGcall('adblock_is_paused')
  // }//end of if SAFARI
})();
