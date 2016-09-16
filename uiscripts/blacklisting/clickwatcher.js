// Requires overlay.js and jQuery

// Highlight DOM elements with an overlayed box, similar to Webkit's inspector.
// Creates an absolute-positioned div that is translated & scaled following
// mousemove events. Holds a pointer to target DOM element.
class Highlighter {
    constructor() {
        var target = null;
        var enabled = false;
        var then = Date.now();
        var box = $("<div class='adblock-highlight-node'></div>");
        box.appendTo("body");

        function handler(e) {
            var offset, el = e.target;
            var now = Date.now();
            if (now - then < 25) {
                return;
            }
            then = now;
            if (el === box[0]) {
                box.hide();
                el = document.elementFromPoint(e.clientX, e.clientY);
            }
            if (el === target) {
                box.show();
                return;
            }
            if (el === document.body || el.className === "adblock-killme-overlay") {
                box.hide();
                return;
            }
            el = $(el);
            target = el[0];
            offset = el.offset();
            box.css({
                height: el.outerHeight(),
                width: el.outerWidth(),
                left: offset.left,
                top: offset.top
            });
            box.show();
        }

        this.getCurrentNode = function(el) {
            return el === box[0] ? target : el;
        };

        this.enable = function() {
            if (box && !enabled) {
                $("body").on("mousemove", handler);
            }
            enabled = true;
        };

        this.disable = function() {
            if (box && enabled) {
                box.hide();
                $("body").off("mousemove", handler);
            }
            enabled = false;
        };

        this.destroy = function() {
            this.disable();
            if (box) {
                box.remove();
                box = null;
            }
        };
    }
}

// Class that watches the whole page for a click, including iframes and
// objects.  Shows a modal while doing so.
class ClickWatcher {
    constructor() {
        this._callbacks = { "cancel": [], "click": [] };
        this._clicked_element = null;
        this._highlighter = new Highlighter();
    }

    cancel(callback) {
        this._callbacks.cancel.push(callback);
    }

    click(callback) {
        this._callbacks.click.push(callback);
    }

    _fire(eventName, arg) {
        var callbacks = this._callbacks[eventName];
        for (var i = 0; i < callbacks.length; i++) {
            callbacks[i](arg);
        }
    }

    show() {
        var that = this;
        var wait = $("<div></div>").
        append(translate("findingads")).
        dialog({
            dialogClass: "adblock-blacklist-dialog",
            position: [50, 50],
            height: 120,
            minHeight: 120,
            title: translate("blockanadtitle")
        });
        changeTextDirection($("body .adblock-blacklist-dialog"));
        // setTimeout to give 'wait' a chance to display
        window.setTimeout(function() {
            that._ui = that._build_ui();
            wait.dialog("close");
            wait.remove();
            that._ui.dialog("open");
            that._highlighter.enable();
        }, 10);
    }

    // Called externally to close ClickWatcher.  Doesn't cause any events to
    // fire.
    close() {
        // Delete our event listeners so we don't fire any cancel events
        this._callbacks.cancel = [];
        if (this._ui) {
            this._ui.dialog("close");
        }
    }

    // The dialog is closing, either because the user clicked cancel, or the
    // close button, or because they clicked an item.
    _onClose() {
        if (this._clicked_element === null) {
            // User clicked Cancel button or X
            this._fire("cancel");
        } else {
            // User clicked a page item
            this._fire("click", this._clicked_element);
        }
        this._highlighter.destroy();
    }

    _build_ui() {
        var that = this;

        function click_catch_this() {
            return click_catch(this);
        }

        function click_catch(element) {
            that._clicked_element = that._highlighter.getCurrentNode(element);
            //that._clicked_element = element;
            that._ui.dialog("close");
            return false;
        }


        // Most things can be blacklisted with a simple click handler.
        $("body").on("click", ".adblock-killme-overlay, .adblock-highlight-node",
                     click_catch_this);

        // Since iframes that will get clicked will almost always be an entire
        // ad, and I *really* don't want to figure out inter-frame communication
        // so that the blacklist UI's slider works between multiple layers of
        // iframes... just overlay iframes and treat them as a giant object.
        $("object, embed, iframe, [onclick]:empty").
        each(function(i, dom_element) {
            var killme_overlay = new Overlay({
                dom_element: dom_element,
                click_handler: click_catch
            });
            killme_overlay.display();
        });

        var btn = {};
        btn[translate("buttoncancel")] = function() {
            $(".adblock-ui-stylesheet").remove();
            page.dialog("close");
        };

        var page = $("<div></div>").
        append(translate("clickthead")).
        append("<br/><br/>").
        dialog({
            dialogClass: "adblock-blacklist-dialog",
            position: [50, 50],
            width: 400,
            minHeight: 125,
            autoOpen: false,
            title: translate("blockanadtitle"),
            buttons: btn,
            close: function() {
                $("body").off("click",
                              ".adblock-killme-overlay, .adblock-highlight-node", click_catch_this);
                Overlay.removeAll();
                that._onClose();
                page.remove();
            },
            drag: function() {
                that._highlighter.disable();
            }
        });

        page.dialog("widget").
        css("position", "fixed").
        on("mouseenter", function() {
            that._highlighter.disable();
        }).
        on("mouseleave", function() {
            that._highlighter.enable();
        });
        changeTextDirection($("body .adblock-blacklist-dialog"));
        return page;
    }
}