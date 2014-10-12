      // TODO temp code to convert Safari from localStorage to settings.
      // Added 11/2011.
      (function() {
        if (!SAFARI)
          return;
        if (safari.extension.settings.userid)
          return; // already did it
        var toCopy = [
          "custom_filters", "filter_lists", "next_ping_time", "saw_badge_info_version",
          "saw_badge_version", "saw_install_page", "settings", "total_pings", "userid"
        ];
        for (var i = 0; i < toCopy.length; i++) {
          var key = toCopy[i];
          if (localStorage[key] !== undefined) {
            // Copy the stringified value from localStorage directly into settings
            var value = localStorage[key];
            safari.extension.settings[key] = value;
          }
        }
      })();
