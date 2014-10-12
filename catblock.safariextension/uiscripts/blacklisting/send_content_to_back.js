if (typeof(send_content_to_back) == "undefined") {

send_content_to_back = function() {
  // Objects and embeds can catch our clicks unless we lay a div over
  // them.  But even then they can catch our clicks unless they were loaded
  // with wmode=transparent.  So, make them load that way, so that our
  // overlaid div catches the clicks instead.
  // We force a hide and show so they reload with wmode=transparent.  I've
  // seen cases (e.g. mtv3.fi's right side ad) where the show was so fast
  // that the wmode=transparent hadn't been applied; thus, we delay 250ms
  // before showing.
  $("object").each(function(i, el) {
      $(el).
        hide().
        append('<param name="wmode" value="transparent">');
      window.setTimeout(function() { log("showing"); $(el).show(); }, 250);
    });
  $("embed").each(function(i, el) {
      $(el).
        hide().
        attr('wmode', 'transparent');
      window.setTimeout(function() { log("showing"); $(el).show(); }, 250);
    });

  // Also, anybody with a z-index over 1 million is going to get in our
  // way.  Decrease it.
  $('[style*="z-index"]').
    filter(function(i) {
        return $(this).css('z-index') >= 1000000;
      }).
    each(function(i, el) {
        $(el).css('z-index', 999999);
    });
};

}

//@ sourceURL=/uiscripts/blacklisting/send_content_to_back.js