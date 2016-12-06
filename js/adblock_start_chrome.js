const elementPurger = {
    onPurgeRequest: function(request, sender, sendResponse) {
        if (request.command === "purge-elements" &&
            request.frameUrl === document.location.href.replace(/#.*$/, "")) {
            elementPurger._purgeElements(request);
            sendResponse({});
        }
    },

    // Remove elements on the page of |request.elType| that request
    // |request.url|.  Will try again if none are found unless |lastTry|.
    _purgeElements: function(request, lastTry) {
        const elType = request.elType;
        const url = getUnicodeUrl(request.url);

        log("[DEBUG]", "Purging:", lastTry, elType, url);

        let tags = {};
        tags[ElementTypes.image] = { IMG: 1 };
        tags[ElementTypes.subdocument] = { IFRAME: 1, FRAME: 1 };
        tags[ElementTypes.object] = { "OBJECT": 1, EMBED: 1 };

        const srcdata = this._srcsFor(url);
        for (let i=0; i < srcdata.length; i++) {
            for (let tag in tags[elType]) {
                const src = srcdata[i];
                const attr = (tag === "OBJECT" ? "data" : "src");
                let selector = "";
                // A selector containing an object is not a valid selector (reddit.com),
                // therefore we need to slice a processed selector
                if (src.text.indexOf("{") > -1) {
                    selector = tag + "[" + attr + "*='" + src.text.slice(0, src.text.indexOf("{")) + "']";
                } else {
                    selector = tag + "[" + attr + src.op + "'" + src.text + "']";
                }

                const results = document.querySelectorAll(selector);

                log("[DEBUG]", "  ", results.length, "results for selector:", selector);
                if (results.length) {
                    for (let j=0; j < results.length; j++) {
                        destroyElement(results[j], elType);
                    }
                    request.selector = selector;
                    chrome.runtime.sendMessage(request);

                    return; // I doubt the same URL was loaded via 2 different src attrs.
                }
            }
        }

        // No match; try later.  We may still miss it (race condition) in which
        // case we give up, rather than polling every second or waiting 10 secs
        // and causing a jarring page re-layout.
        if (!lastTry) {
            const that = this;
            setTimeout(function() { that._purgeElements(request, true); }, 2000);
        }
    },

    // Return a list of { op, text }, where op is a CSS selector operator and
    // text is the text to select in a src attr, in order to match an element on
    // this page that could request the given absolute |url|.
    _srcsFor: function(url) {
        // NB: <img src="a#b"> causes a request for "a", not "a#b".  I'm
        // intentionally ignoring IMG tags that uselessly specify a fragment.
        // AdBlock will fail to hide them after blocking the image.
        const url_parts = parseUri(url), page_parts = this._page_location;
        let results = [];
        // Case 1: absolute (of the form "abc://de.f/ghi" or "//de.f/ghi")
        results.push({ op:"$=", text: url.match(/\:(\/\/.*)$/)[1] });
        if (url_parts.hostname === page_parts.hostname) {
            const url_search_and_hash = url_parts.search + url_parts.hash;
            // Case 2: The kind that starts with "/"
            results.push({ op:"=", text: url_parts.pathname + url_search_and_hash });
            // Case 3: Relative URL (of the form "ab.cd", "./ab.cd", "../ab.cd" and
            // "./../ab.cd")
            const page_dirs = page_parts.pathname.split("/");
            const url_dirs = url_parts.pathname.split("/");
            let i = 0;
            while (page_dirs[i] === url_dirs[i] &&
                   i < page_dirs.length - 1 &&
                   i < url_dirs.length - 1) {
                i++; // i is set to first differing position
            }
            const dir = new Array(page_dirs.length - i).join("../");
            const path = url_dirs.slice(i).join("/") + url_search_and_hash;
            if (dir) {
                results.push({ op: "$=", text: dir + path });
            } else {
                results.push({ op: "=", text: path });
                results.push({ op: "=", text: "./" + path });
            }
        }

        return results;
    },

    // To enable testing
    _page_location: document.location
};

adblock_begin({
    startPurger: function() {
        chrome.runtime.onMessage.addListener(elementPurger.onPurgeRequest);
    },
    stopPurger: function() {
        chrome.runtime.onMessage.removeListener(elementPurger.onPurgeRequest);
    },
    handleHiding: function(data) {
        if (data && data.hiding) {
            block_list_via_css(data.selectors);
        }
    }
});
