if (/youtube/.test(document.location.hostname)) {
  // Get actual URL
  var url = document.location.href;

  // Get enabled settings everytime in Safari
  if (SAFARI) {
    BGcall("get_settings", function(settings) {
      if (settings.youtube_channel_whitelist)
        channel();
    });
  } else {
    channel();
  }

  // Function which: - grabs the name of the channel from the page
  //                 - puts the name of the channel on the end of the URL e.g. &channel=nameofthechannel
  //                 - reload the page, so AdBlock can properly whitelist the channel
  //                   (if channel is whitelisted by user)
  function channel() {
    if ((url.search("channel=") < 0) && (/channel\/|watch/.test(url)) && (url.search("feed") < 0)) {
        var get_yt_name = document.querySelector("span[itemprop='author'] link");
        if (get_yt_name) {
            var extracted_name = get_yt_name.getAttribute("href").split('/').pop();
        } else {
            return;
        }
        if (/channel/.test(url)) {
          var new_url = url+"?&channel="+extracted_name;
        } else {
          var new_url = url+"&channel="+extracted_name;
        }
        // Add the name of the channel to the end of URL
        window.history.replaceState(null,null,new_url);
        // Reload page from cache
        document.location.reload(false);
    }
  }
}