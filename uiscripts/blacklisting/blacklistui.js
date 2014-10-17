// Requires clickwatcher.js and elementchain.js and jQuery


// Hide the specified CSS selector on the page, or if null, stop hiding.
function preview(selector) {
  $("#adblock_blacklist_preview_css").remove();
  if (!selector) return;
  var css_preview = document.createElement("style");
  css_preview.type = "text/css";
  css_preview.id = "adblock_blacklist_preview_css";
  var d = "body .ui-dialog:last-child ";

  // Show the blacklist UI.
  css_preview.innerText = d + "input {display:inline-block!important;} " +
      d + ", " + d + "div:not(#filter_warning), " + d + ".ui-icon, " + d +
      "a, " + d + "center, " + d +
      "button {display:block!important;} " +  d + "#adblock-details, " + d +
      "span, " + d + "b, " + d + "i {display:inline!important;} ";
  // Hide the specified selector.
  css_preview.innerText += selector + " {display:none!important;}";

  document.documentElement.appendChild(css_preview);
}

// Wizard that walks the user through selecting an element and choosing
// properties to block.
// clicked_item: the element that was right clicked, if any.
// advanced_user:bool
function BlacklistUi(clicked_item, advanced_user) {
  // If a dialog is ever closed without setting this to false, the
  // object fires a cancel event.
  this._cancelled = true;

  this._callbacks = { 'cancel': [], 'block': [] };

  this._clicked_item = clicked_item;
  this._advanced_user = advanced_user;
}

// TODO: same event framework as ClickWatcher
BlacklistUi.prototype.cancel = function(callback) {
  this._callbacks.cancel.push(callback);
}
BlacklistUi.prototype.block = function(callback) {
  this._callbacks.block.push(callback);
}
BlacklistUi.prototype._fire = function(eventName, arg) {
  var callbacks = this._callbacks[eventName];
  for (var i = 0; i < callbacks.length; i++)
    callbacks[i](arg);
}
BlacklistUi.prototype._onClose = function() {
  if (this._cancelled == true) {
    this._ui_page1.empty().remove();
    this._ui_page2.empty().remove();
    this._chain.current().show();
    this._fire('cancel');
  }
}
BlacklistUi.prototype.handle_change = function() {
  this._last.show();
  this._chain.current().hide();
  this._last = this._chain.current();
  this._redrawPage1();
  this._redrawPage2();
}


BlacklistUi.prototype.show = function() {
  // If we don't know the clicked element, we must find it first.
  if (this._clicked_item == null) {
    var clickWatcher = new ClickWatcher();
    var that = this;
    clickWatcher.cancel(function() {
      that._fire('cancel');
    });
    clickWatcher.click(function(element) {
      that._clicked_item = element;
      that.show();
    });
    clickWatcher.show();
    return;
  }

  // If we do know the clicked element, go straight to the slider.
  else {
    this._chain = new ElementChain(this._clicked_item);
    this._last = this._chain.current();
    this._chain.change(this, this.handle_change);
    this._chain.change();

    this._ui_page1 = this._build_page1();
    this._ui_page2 = this._build_page2();
    this._redrawPage1();
    this._ui_page1.dialog('open');
  }
}

BlacklistUi.prototype._build_page1 = function() {
  var that = this;

  var link_to_block = $("<a>", {
    id: "block_by_url_link",
    href: "#",
    tabIndex: -1,
    css: { 
      "display": "none"
    },
    text: translate("block_by_url_instead"),
    click: function(e) {
      var el = that._chain.current();
      var elType = typeForElement(el[0]);
      var type = ElementTypes.NONE;
      if (elType == ElementTypes.image)
        type = "image";
      else if (elType == ElementTypes.object)
        type = "object";
      else if (elType == ElementTypes.media)
        type = "media";
      else if (elType == ElementTypes.subdocument)
        type = "subdocument";
      var srcUrl = relativeToAbsoluteUrl(el.attr("src") || el.attr("data"));
      var tabUrl = document.location.href;
      var query = '?itemType=' + type + '&itemUrl=' + escape(srcUrl) + 
                  '&url=' + escape(tabUrl);
      window.open(chrome.extension.getURL('pages/resourceblock.html' 
            + query), "_blank", 'location=0,width=1024,height=590');
      e.preventDefault();
      that._ui_page1.dialog('close');
      return false;
    }
  });
  link_to_block[0].style.setProperty("font-size", "11px", "important"); // crbug.com/110084

  var page = $("<div>").
    append(translate("sliderexplanation")).
    append("<br/>").
    append("<input id='slider' type='range' min='0' value='0'/>").
    append("<div id='selected_data' style='font-size:smaller; height:7em'></div>").
    append(link_to_block);

  var btns = {};
  btns[translate("buttonlooksgood")] = 
      function() {
        that._cancelled = false;
        that._ui_page1.dialog('close');
        that._cancelled = true;
        that._redrawPage2();
        that._ui_page2.dialog('open');
        preview($('#summary', that._ui_page2).text());
      }
  btns[translate("buttoncancel")] = 
      function() {
        that._ui_page1.dialog('close');
      }

  page.dialog({
      zIndex: 10000000, 
      position: [50, 50],
      width: 410,
      autoOpen: false,
      title: translate("slidertitle"),
      buttons: btns,
      close: function() {
        that._onClose();
      }
    }).css({
      'background': 'white',
      'text-align': 'left',
      'font-size': '12px',
    });
  page.dialog("widget").css("position", "fixed");

  var depth = 0;
  var guy = this._chain.current();
  while (guy.length > 0 && guy[0].nodeName != "BODY") {
    guy = guy.parent();
    depth++;
  }
  $("#slider", page).
    css('width', '364px').
    attr("max", Math.max(depth - 1, 1)).
    change(function() {
      that._chain.moveTo(this.valueAsNumber);
    });

  return page;
}

BlacklistUi.prototype._build_page2 = function() {
  var that = this;
  
  var page = $("<div>" + translate("blacklisteroptions1") +
    "<div>" +
    "<div style='margin-left:15px' id='adblock-details'></div><br/>" +
    "<div style='background:#eeeeee;border: 1px solid #dddddd;" +
    " padding: 3px;' id='count'></div>" +
    "</div>" +
    "<div>" +
    "<br/>" + translate("blacklisternotsure") +
    "<br/><br/></div>" +
    "<div style='clear:left; font-size:smaller'>" +
    "<br/>" + translate("blacklisterthefilter") +
    "  <div style='margin-left:15px;margin-bottom:15px'>" +
    "    <div>" +
    "      <div id='summary'></div><br/>" +
    "      <div id='filter_warning'></div>" +
    "    </div>" +
    "  </div>" +
    "</div>" +
    "</div>");

  var btns = {};
  btns[translate("buttonblockit")] =
      function() {
        var rule = $("#summary", that._ui_page2).text();
        if (rule.length > 0) {
          var filter = document.location.hostname + "##" + rule;
          BGcall('add_custom_filter', filter, function() {
            block_list_via_css([rule]);
            that._ui_page2.dialog('close');
            that._fire('block');
          });
        } else {alert(translate("blacklisternofilter"));}
      }
  btns[translate("buttoncancel")] =
      function() {
        that._ui_page2.dialog('close');
      }
  if (that._advanced_user)
    btns[translate("buttonedit")] =
      function() {
        var custom_filter = document.location.hostname + '##' + $("#summary", that._ui_page2).text();
        that._ui_page2.dialog('close');
        custom_filter = prompt(translate("blacklistereditfilter"), custom_filter);
        if (custom_filter) {//null => user clicked cancel
          if (!/\#\#/.test(custom_filter))
            custom_filter = "##" + custom_filter;
          BGcall('add_custom_filter', custom_filter, function(ex) {
            if (!ex) {
              block_list_via_css([custom_filter.substr(custom_filter.indexOf('##') + 2)]);
              that._fire('block');
            } else
              alert(translate("blacklistereditinvalid1", ex));
          });
        }
      }
  btns[translate("buttonback")] = 
      function() {
        that._cancelled = false;
        that._ui_page2.dialog('close');
        that._cancelled = true;
        that._redrawPage1();
        that._ui_page1.dialog('open');
      }

  page.dialog({
      zIndex:10000000, 
      position:[50, 50],
      width: 500,
      autoOpen: false,
      title: translate("blacklisteroptionstitle"),
      buttons: btns,
      close: function() {
        that._onClose();
        preview(null); // cancel preview
      }
    }).css({
      'background': 'white',
      'text-align': 'left',
      'font-size': '12px',
    });

  return page;
}
BlacklistUi.prototype._redrawPage1 = function() {
  var el = this._chain.current();
  var show_link = (this._advanced_user &&
    /^https?\:\/\//.test(relativeToAbsoluteUrl(el.attr("src") || el.attr("data"))));
  $("#block_by_url_link", this._ui_page1).toggle(show_link);

  var selected_data = $("#selected_data", this._ui_page1);
  selected_data.html("<b>" + translate("blacklisterblockedelement") + "</b><br/>");

  selected_data.append($("<i></i>").text("<" + el[0].nodeName));
  var attrs = ["id", "class", "name", "src", "href", "data"];
  for (var i in attrs) {
    var val = BlacklistUi._ellipsis(el.attr(attrs[i]));
    if (val)
      selected_data.append("<br/>").
                  append($("<i></i>").
                           text(attrs[i] + '="' + val + '"').
                           css("margin-left", "10px"));
  }
  selected_data.append("<i>&nbsp;&gt;</i>");
}

// Return the CSS selector generated by the blacklister.  If the
// user has not yet gotten far enough through the wizard to
// determine the selector, return an empty string.
BlacklistUi.prototype._makeFilter = function() {
  var result = [];

  var el = this._chain.current();
  var detailsDiv = $("#adblock-details", this._ui_page2);

  if ($("input:checkbox#cknodeName", detailsDiv).is(':checked')) {
    result.push(el.prop('nodeName'));
    // Some iframed ads are in a bland iframe.  If so, at least try to
    // be more specific by walking the chain from the body to the iframe
    // in the CSS selector.
    if (el.prop('nodeName') == 'IFRAME' && el.attr('id') == '') {
      var cur = el.parent();
      while (cur.prop('nodeName') != 'BODY') {
        result.unshift(cur.prop('nodeName') + " ");
        cur = cur.parent();
      }
    }
  }
  var attrs = ['id', 'class', 'name', 'src', 'href', 'data'];
  function fixStr(str) {
    var q = str.indexOf('"') != -1 ? "'" : '"';
    return q + str + q;
  }
  for (var i in attrs) {
    if ($("input:checkbox#ck" + attrs[i], detailsDiv).is(':checked'))
      result.push('[' + attrs[i] + '=' + fixStr(el.attr(attrs[i])) + ']');
  }

  var warningMessage;
  if (result.length == 0)
    warningMessage = translate("blacklisterwarningnofilter");
  else if (result.length == 1 && $("input:checkbox#cknodeName", detailsDiv).is(':checked'))
    warningMessage = translate("blacklisterblocksalloftype", [result[0]]);
  $("#filter_warning", this._ui_page2).
    css("display", (warningMessage ? "block" : "none")).
    css("font-weight", "bold").
    css("color", "red").
    text(warningMessage);
  return result.join('');
}

BlacklistUi.prototype._redrawPage2 = function() {

  var el = this._chain.current();
  var that = this;

  var detailsDiv = $("#adblock-details", that._ui_page2);

  var summary = $("#summary", that._ui_page2);

  function updateFilter() {
    var theFilter = that._makeFilter();

    summary.text(theFilter);

    var matchCount = $(theFilter).not(".ui-dialog").not(".ui-dialog *").length;

    $("#count", that._ui_page2).
      html("<center>" + ((matchCount == 1) ? 
          translate("blacklistersinglematch") :
          translate("blacklistermatches", ["<b>" + matchCount + "</b>"])) 
          + "</center>");
  }

  detailsDiv.empty();
  var attrs = ['nodeName', 'id', 'class', 'name', 'src', 'href', 'data'];
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i];
    var longVal = (attr == "nodeName" ? el.prop("nodeName") : el.attr(attr));
    var val = BlacklistUi._ellipsis(longVal);

    if (!val)
      continue;

    // Check src, data and href only by default if no other identifiers are
    // present except for the nodeName selector.
    var checked = true;
    if (attr == 'src' || attr == 'href' || attr == 'data')
      checked = $("input", detailsDiv).length == 1;

    var italic = $("<i></i>").text(val);
    var checkboxlabel = $("<label></label>").
      html(translate("blacklisterattrwillbe", 
           ["<b>" + (attr == 'nodeName' ? translate("blacklistertype") : attr) +
            "</b>", "<i></i>"])).
      attr("for", "ck" + attr).
      css("cursor", "pointer");
    $('i', checkboxlabel).replaceWith(italic);

    var checkbox = $("<div></div>").
      append("<input type=checkbox " + (checked ? 'checked="checked"': '') +
             " id=ck" + attr + " /> ").
      append(checkboxlabel);

    checkbox.find("input").change(function() {
      updateFilter();
      preview($("#summary", this._ui_page2).text());
    });

    detailsDiv.append(checkbox);
  }

  updateFilter();
}

// Return a copy of value that has been truncated with an ellipsis in
// the middle if it is too long.
// Inputs: value:string - value to truncate
//         size?:int - max size above which to truncate, defaults to 50
BlacklistUi._ellipsis = function(value, size) {
  if (value == null)
    return value;

  if (size == undefined)
    size = 50;

  var half = size / 2 - 2; // With ellipsis, the total length will be ~= size

  if (value.length > size)
    value = (value.substring(0, half) + "..." + 
             value.substring(value.length - half));

  return value;
}

//@ sourceURL=/uiscripts/blacklisting/blacklistui.js
