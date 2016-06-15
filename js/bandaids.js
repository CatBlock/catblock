var run_bandaids = function() {
    // Tests to determine whether a particular bandaid should be applied
    var apply_bandaid_for = "";
    if (/mail\.live\.com/.test(document.location.hostname)) {
        apply_bandaid_for = "hotmail";
    } else if (/mobilmania\.cz|zive\.cz|doupe\.cz|e15\.cz|sportrevue\.cz|autorevue\.cz/.test(document.location.hostname)) {
        apply_bandaid_for = "czech_sites";
    } else {
        var hosts = [ /mastertoons\.com$/ ];
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
                if(id) {
                    styles[i].innerText = '#' + id[1] + ' { display: none }';
                }
            }
        },
        hotmail: function() {
            // Removing the space remaining in Hotmail/WLMail
            var css_chunk = document.createElement("style");
            css_chunk.type = "text/css";
            (document.head || document.documentElement).insertBefore(css_chunk, null);
            css_chunk.sheet.insertRule(".WithRightRail { right:0px !important; }", 0);
            css_chunk.sheet.insertRule("#RightRailContainer  { display:none !important; visibility: none !important; orphans: 4321 !important; }" , 0);
        },
        czech_sites: function() {
            var player = document.getElementsByClassName("flowplayer");
            // Remove data-ad attribute from videoplayer
            if (player) {
                for (var i=0; i<player.length; i++)
                    player[i].removeAttribute("data-ad");
            }
        }
    }; // end bandaids

    if (apply_bandaid_for) {
        log("Running bandaid for " + apply_bandaid_for);
        bandaids[apply_bandaid_for]();
    }

};


var before_ready_bandaids = function() {

};