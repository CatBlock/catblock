class Overlay {
    constructor(options) {
        if (!Overlay.instances) {
            Overlay.instances = [];
        }

        var el = $(options.dom_element);

        this.image = $("<div class='adblock-killme-overlay'></div>").
        css({
            "left": el.position().left,
            "top": el.position().top
        }).
        width(el.width()).
        height(el.height());

        this.el = el;
        this.click_handler = options.click_handler;

        this.image.
        on("mouseenter",function() {
            // crbug.com/110084
            this.style.setProperty("background-color", "rgba(130, 180, 230, 0.5)", "important");
        }).
        on("mouseleave",function() {
            // crbug.com/110084
            this.style.setProperty("background-color", "transparent", "important");
        });

        Overlay.instances.push(this);
    }

    display() {
        var that = this;
        this.image.
        appendTo(that.el.parent()).
        click(function() {
            that.click_handler(that.el);
            return false;
        });
    }

    static removeAll() {
        $.each(Overlay.instances, function(i, overlay) {
            overlay.image.remove();
        });
        Overlay.instances = [];
    }
}