// Requires clickwatcher.js and elementchain.js and jQuery


// Create a selector that matches an element.
function selector_from_elm(el) {
    var attrs = ["id", "class", "name", "src", "href", "data"];
    var result = [el.prop("nodeName")];
    for (var i = 0; i < attrs.length; i++) {
        var attr = attrs[i];
        var val = el.attr(attr);
        if (val) {
            result.push("[" + attr + "=" + JSON.stringify(val) + "]");
        }
    }
    return result.join("");
}

// Wizard that walks the user through selecting an element and choosing
// properties to block.
// clicked_item: the element that was right clicked, if any.
// advanced_user:bool
class BlacklistUi {
    constructor(clicked_item, advanced_user) {
        // If a dialog is ever closed without setting this to false, the
        // object fires a cancel event.
        this._cancelled = true;

        // steps through dialog - see _preview()
        this._current_step = 0;

        this._callbacks = { "cancel": [], "block": [] };

        this._clicked_item = clicked_item;
        this._advanced_user = advanced_user;
    }

    // TODO: same event framework as ClickWatcher
    cancel(callback) {
        this._callbacks.cancel.push(callback);
    }

    block(callback) {
        this._callbacks.block.push(callback);
    }

    _fire(eventName, arg) {
        var callbacks = this._callbacks[eventName];
        for (var i = 0; i < callbacks.length; i++) {
            callbacks[i](arg);
        }
    }

    _onClose() {
        if (this._cancelled === true) {
            this._ui_page1.empty().remove();
            this._ui_page2.empty().remove();
            $(".adblock-ui-stylesheet").remove();
            this._chain.current().show();
            this._fire("cancel");
        }
    }

    handle_change() {
        this._last.show();
        this._chain.current().hide();
        this._last = this._chain.current();
        this._redrawPage1();
        this._redrawPage2();
        this._preview(selector_from_elm(this._chain.current()));
    }

    show() {
        // If we don't know the clicked element, we must find it first.
        if (this._clicked_item === null) {
            var clickWatcher = new ClickWatcher();
            var that = this;
            clickWatcher.cancel(function() {
                that._preview(null);
                that._fire("cancel");
            });
            clickWatcher.click(function(element) {
                that._clicked_item = element;
                that.show();
            });
            this._preview("*");
            clickWatcher.show();
            return;
        }

        // If we do know the clicked element, go straight to the slider.
        else {
            this._chain = new ElementChain(this._clicked_item);

            this._ui_page1 = this._build_page1();
            this._ui_page2 = this._build_page2();

            this._last = this._chain.current();
            this._chain.change(this, this.handle_change);
            this._chain.change();

            this._redrawPage1();
            this._ui_page1.dialog("open");
        }
    }

    _build_page1() {
        var that = this;

        var page = $("<div>").
        append(translate("sliderexplanation")).
        append("<br/>").
        append("<input id='slider' type='range' min='0' value='0'/>").
        append("<div id='selected_data'></div>");

        var btns = {};
        var adblock_default_button_text = translate("buttonlooksgood");
        btns[adblock_default_button_text] = {
            text: adblock_default_button_text,
            "class": "adblock_default_button",
            click: function() {
                that._cancelled = false;
                that._ui_page1.dialog("close");
                that._cancelled = true;
                that._redrawPage2();
                that._ui_page2.dialog("open");
            }
        };

        btns[translate("buttoncancel")] = function() {
            that._ui_page1.dialog("close");
        };

        page.dialog({
            dialogClass: "adblock-blacklist-dialog",
            position: [50, 50],
            width: 410,
            autoOpen: false,
            title: translate("slidertitle"),
            buttons: btns,
            open: function() {
                that._current_step = 1;
                that._preview(selector_from_elm(that._chain.current()));
            },
            close: function() {
                that._preview(null);
                that._onClose();
            }
        });
        page.dialog("widget").css("position", "fixed");
        changeTextDirection($("body .adblock-blacklist-dialog"));

        var depth = 0;
        var guy = this._chain.current();
        while (guy.length > 0 && guy[0].nodeName !== "BODY") {
            guy = guy.parent();
            depth++;
        }
        $("#slider", page).
        attr("max", Math.max(depth - 1, 1)).
        on("input change", function() {
            that._chain.moveTo(this.valueAsNumber);
        });

        return page;
    }

    _build_page2() {
        var that = this;

        var page = $("<div>" + translate("blacklisteroptions1") +
                     "<div>" +
                     "<div id='adblock-details'></div><br/>" +
                     "<div id='count'></div>" +
                     "</div>" +
                     "<div>" +
                     "<br/>" + translate("blacklisternotsure") +
                     "<br/><br/></div>" +
                     "<div style='clear:left; font-size:smaller; margin-top: -20px;'>" +
                     "<br/>" + translate("blacklisterthefilter") +
                     "<div style='margin-left:15px;margin-bottom:15px'>" +
                     "<div>" +
                     "<div id='summary'></div><br/>" +
                     "<div id='filter_warning'></div>" +
                     "</div>" +
                     "</div>" +
                     "</div>" +
                     "</div>");

        var btns = {};
        var adblock_default_button_text = translate("buttonblockit");
        btns[adblock_default_button_text] = {
            text: adblock_default_button_text,
            "class": "adblock_default_button",
            click: function() {
                var rule = $("#summary", that._ui_page2).text();
                if (rule.length > 0) {
                    var filter = parseURI.getUnicodeDomain(document.location.hostname) + "##" + rule;
                    BGcall("add_custom_filter", filter, function() {
                        block_list_via_css([rule]);
                        that._ui_page2.dialog("close");
                        that._fire("block");
                    });
                } else {
                    alert(translate("blacklisternofilter"));
                }
            }
        };

        if (that._advanced_user) {
            btns[translate("buttonedit")] = function() {
                var custom_filter = parseURI.getUnicodeDomain(document.location.hostname) + "##" + $("#summary", that._ui_page2).text();
                that._ui_page2.dialog("close");
                custom_filter = prompt(translate("blacklistereditfilter"), custom_filter);
                if (custom_filter) { //null => user clicked cancel
                    if (!/\#\#/.test(custom_filter)) {
                        custom_filter = "##" + custom_filter;
                    }
                    BGcall("add_custom_filter", custom_filter, function(ex) {
                        if (!ex) {
                            block_list_via_css([custom_filter.substr(custom_filter.indexOf("##") + 2)]);
                            that._fire("block");
                        } else {
                            alert(translate("blacklistereditinvalid1", ex));
                        }
                    });
                }
            };
        }

        btns[translate("buttonback")] = function() {
            that._cancelled = false;
            that._ui_page2.dialog("close");
            that._cancelled = true;
            that._redrawPage1();
            that._ui_page1.dialog("open");
        };

        btns[translate("buttoncancel")] = function() {
            that._ui_page2.dialog("close");
        };

        page.dialog({
            dialogClass: "adblock-blacklist-dialog ui-page-2",
            position:[50, 50],
            width: 500,
            autoOpen: false,
            title: translate("blacklisteroptionstitle"),
            buttons: btns,
            open: function() {
                that._current_step = 2;
                that._preview($("#summary", that._ui_page2).text());
            },
            close: function() {
                that._preview(null);
                that._onClose();
            }
        });
        page.dialog("widget").css("position", "fixed");
        changeTextDirection($("body .adblock-blacklist-dialog"));

        return page;
    }

    _redrawPage1() {
        var el = this._chain.current();

        var selected_data = $("#selected_data", this._ui_page1);
        selected_data.html("<b>" + translate("blacklisterblockedelement") + "</b><br/>");

        selected_data.append($("<i></i>").text("<" + el[0].nodeName));
        var attrs = ["id", "class", "name", "src", "href", "data"];
        for (var i in attrs) {
            var val = BlacklistUi._ellipsis(el.attr(attrs[i]));
            if (val) {
                selected_data.append("<br/>").
                append($("<i></i>").
                       text(attrs[i] + "='" + val + "'").
                       css("margin-left", "10px"));
            }
        }
        selected_data.append("<i>&nbsp;&gt;</i>");
    }

    // Return the CSS selector generated by the blacklister.  If the
    // user has not yet gotten far enough through the wizard to
    // determine the selector, return an empty string.
    _makeFilter() {
        var result = [];

        var el = this._chain.current();
        var detailsDiv = $("#adblock-details", this._ui_page2);

        if ($("input[type='checkbox']#cknodeName", detailsDiv).is(":checked")) {
            result.push(el.prop("nodeName"));
            // Some iframed ads are in a bland iframe.  If so, at least try to
            // be more specific by walking the chain from the body to the iframe
            // in the CSS selector.
            if (el.prop("nodeName") === "IFRAME" && el.attr("id") === "") {
                var cur = el.parent();
                while (cur.prop("nodeName") !== "BODY") {
                    result.unshift(cur.prop("nodeName") + " ");
                    cur = cur.parent();
                }
            }
        }
        var attrs = ["id", "class", "name", "src", "href", "data"];
        for (var i in attrs) {
            if ($("input[type='checkbox']#ck" + attrs[i], detailsDiv).is(":checked")) {

                let data = el.attr(attrs[i]);

                function isURL(data) {
                    return data.indexOf("http://") > -1 || data.indexOf("https://") > -1
                }

                if (isURL(data)) {
                    result.push("[" + attrs[i] + "=" + JSON.stringify(new parseURI(data).href) + "]");
                } else {
                    result.push("[" + attrs[i] + "=" + JSON.stringify(data) + "]");
                }
            }
        }

        var warningMessage;
        if (result.length === 0) {
            warningMessage = translate("blacklisterwarningnofilter");
        } else if (result.length === 1 && $("input[type='checkbox']#cknodeName", detailsDiv).is(":checked")) {
            warningMessage = translate("blacklisterblocksalloftype", [result[0]]);
        }
        $("#filter_warning", this._ui_page2).
        css("display", (warningMessage ? "block" : "none")).
        text(warningMessage);
        return result.join("");
    }

    _redrawPage2() {

        var el = this._chain.current();
        var that = this;

        var detailsDiv = $("#adblock-details", that._ui_page2);

        var summary = $("#summary", that._ui_page2);

        function updateFilter() {
            var theFilter = that._makeFilter();

            summary.text(theFilter);

            var matchCount = $(theFilter).not(".ui-dialog").not(".ui-dialog *").length;

            $("#count", that._ui_page2).
            html("<center>" + ((matchCount === 1) ?
                               translate("blacklistersinglematch") :
                               translate("blacklistermatches", ["<b>" + matchCount + "</b>"])) +
                 "</center>");
        }

        detailsDiv.empty();
        var attrs = ["nodeName", "id", "class", "name", "src", "href", "data"];
        for (var i = 0; i < attrs.length; i++) {
            var attr = attrs[i];
            var longVal = (attr === "nodeName" ? el.prop("nodeName") : el.attr(attr));
            var val = BlacklistUi._ellipsis(longVal);

            if (!val) {
                continue;
            }

            // Check src, data and href only by default if no other identifiers are
            // present except for the nodeName selector.
            var checked = true;
            if (attr === "src" || attr === "href" || attr === "data") {
                checked = $("input", detailsDiv).length === 1;
            }

            var italic = $("<i></i>").text(val);
            var checkboxlabel = $("<label></label>").
            html(translate("blacklisterattrwillbe",
                           ["<b>" + (attr === "nodeName" ? translate("blacklistertype") : attr) +
                            "</b>", "<i></i>"])).
            attr("for", "ck" + attr);
            $("i", checkboxlabel).replaceWith(italic);

            var checkbox = $("<div></div>").
            append("<input type=checkbox " + (checked ? "checked='checked'": "") +
                   " id=ck" + attr + " /> ").
            append(checkboxlabel);

            checkbox.find("input").change(function() {
                updateFilter();
                that._preview($("#summary", that._ui_page2).text());
            });

            detailsDiv.append(checkbox);
        }

        updateFilter();
    }

    // Change the appearance of a CSS selector on the page, or if null, undo the change.
    // Inputs: selector:string - the selector generated by the blacklist wizard
    _preview(selector) {
        $("#adblock_blacklist_preview_css").remove();
        if (!selector) {
            return;
        }

        var css_preview = document.createElement("style");
        css_preview.type = "text/css";
        css_preview.id = "adblock_blacklist_preview_css";

        var d = "body .adblock-blacklist-dialog";

        switch (this._current_step) {
            case 0:
                // Raise highlight.
                css_preview.innerText = "body .adblock-highlight-node,";
                break;
            case 1:
                // Show ui_page1.
                css_preview.innerText = d + ", " + d + " * {opacity:1!important;} ";
                // Fade the selector, while skipping any matching children.
                css_preview.innerText += selector + " {opacity:.1!important;} " +
                    selector + " " + selector + " {opacity:1!important;}";
                break;
            case 2:
                // Show ui_page2.
                css_preview.innerText = d + " input, " + d +
                    " button {display:inline-block!important;} " + d + ".ui-page-2, " + d +
                    " div:not(#filter_warning), " + d + " .ui-icon, " + d + " a, " + d +
                    " center {display:block!important;} " +  d + " #adblock-details, " + d +
                    " span, " + d + " b, " + d + " i {display:inline!important;} ";
                // Hide the specified selector.
                css_preview.innerText += selector + " {display:none!important;}";
        }

        // Finally, raise the UI above *all* website UI, using max 32-bit signed int.
        css_preview.innerText += " " + d + " {z-index:2147483647!important; top:40px}";

        document.documentElement.appendChild(css_preview);
    }

    // Return a copy of value that has been truncated with an ellipsis in
    // the middle if it is too long.
    // Inputs: value:string - value to truncate
    //         size?:int - max size above which to truncate, defaults to 50
    static _ellipsis(value, size) {
        if (!value) {
            return undefined;
        }

        if (size === undefined) {
            size = 50;
        }

        // If we are processing an URL, convert it from punycode to Unicode
        if (value.indexOf("http://") > -1 || value.indexOf("https://") > -1) {
            value = new parseURI(value).href;
        }

        var half = size / 2 - 2; // With ellipsis, the total length will be ~= size

        if (value.length > size) {
            value = (value.substring(0, half) + "..." +
                     value.substring(value.length - half));
        }

        return value;
    }

}