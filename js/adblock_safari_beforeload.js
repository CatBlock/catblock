// Content script when Safari "beforeLoad" API is used
adblock_begin({
    startPurger: function() {
        document.addEventListener("beforeload", beforeLoadHandler, true);
    },
    stopPurger: function() {
        document.removeEventListener("beforeload", beforeLoadHandler, true);
    },
    handleHiding: function(data) {
        if (data.hiding) {
            block_list_via_css(data.selectors);
        }
    },
    success: function() {
        onReady(function() { blockBackgroundImageAd(); });

        // Add entries to right click menu of non-whitelisted pages.
        window.addEventListener("contextmenu", function(event) {
            safari.self.tab.setContextMenuEventUserInfo(event, true);
        }, false);
    }
});
