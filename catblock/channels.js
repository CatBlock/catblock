// Must run on background page

// TODO: make google search results ALWAYS show photos.  Special case it.

// Inputs: width:int, height:int, url:url, title:string, attribution_url:url
function Listing(data) {
    this.width = data.width;
    this.height = data.height;
    this.url = data.url;
    this.title = data.title;
    this.attribution_url = data.attribution_url;
};


// Contains and provides access to all the photo channels.
function Channels() {
    var that = this;
    this._channelGuide = undefined; // maps channel ids to channels and metadata
    this._loadFromStorage();
    that.refreshAllEnabled();
    window.setInterval(
        function() { that.refreshAllEnabled(); },
        1000 * 60 * 60 * 24
    );
}
Channels.prototype = {
    // Inputs:
    //   name:string - a Channel class name.
    //   param:object - the single ctor parameter to the Channel class.
    //   enabled:bool - true if this channel is to be used for pictures.
    // Returns:
    //   id of newly created channel, or undefined if the channel already existed.
    add: function(data) {
        var klass = window[data.name];
        if (!klass)
            return;
        var dataParam = JSON.stringify(data.param);
        for (var id in this._channelGuide) {
            var c = this._channelGuide[id];
            if (c.name === data.name && JSON.stringify(c.param) === dataParam)
                return;
        }
        var id = Math.floor(Math.random() * Date.now());
        var channel = new klass(data.param);
        this._channelGuide[id] = {
            name: data.name,
            param: data.param,
            enabled: true,
            channel: channel
        };
        this._saveToStorage();
        var that = this;
        $(channel).bind("updated", function(event) {
            // TODO: make sure this works in Safari.  And if you fix a bug, fix it
            // in AdBlock too -- it's keeping filter update events from showing up
            // in the AdBlock Options page I think.
            chrome.runtime.sendMessage({command: "channel-updated", id: id});
            if (that._channelGuide[id].enabled)
                that._channelGuide[id].channel.prefetch();
        });
        channel.refresh();
        return id;
    },

    remove: function(channelId) {
        delete this._channelGuide[channelId];
        this._saveToStorage();
    },

    // Return read-only map from each channel ID to
    // { name, param, enabled }.
    getGuide: function() {
        var results = {};
        for (var id in this._channelGuide) {
            var c = this._channelGuide[id];
            results[id] = {
                name: c.name,
                param: c.param,
                enabled: c.enabled,
            };
        }

        return results;
    },

    getListings: function(id) {
        return this._channelGuide[id].channel.getListings();
    },
    setEnabled: function(id, enabled) {
        this._channelGuide[id].enabled = enabled;
        this._saveToStorage();
    },

    refreshAllEnabled: function() {
        for (var id in this._channelGuide) {
            var data = this._channelGuide[id];
            if (data.enabled)
                data.channel.refresh();
        }
    },

    // Returns a random Listing from all enabled channels or from channel
    // |channelId| if specified, trying to match the ratio of |width| and
    // |height| decently.  Returns undefined if there are no enabled channels.
    randomListing: function(opts) {
        var allListings = [];

        for (var id in this._channelGuide) {
            var data = this._channelGuide[id];
            if (opts.channelId === id || (data.enabled && !opts.channelId))
                allListings.push.apply(allListings, data.channel.getListings());
        }
        // TODO: care about |width| and |height|
        var randomIndex = Math.floor(Math.random() * allListings.length);
        return allListings[randomIndex];
    },

    _loadFromStorage: function() {
        this._channelGuide = {};

        var entries = storage_get("channels");
        if (!entries || (entries.length > 0 && !entries[0].name)) {
            // Default set of channels
            this.add({name: "TheCatsOfCatBlockUsersChannel", param: undefined,
                      enabled: true});
            this.add({name: "AprilFoolsCatsChannel", param: undefined, enabled: false});
        }
        else {
            for (var i=0; i < entries.length; i++) {
                this.add(entries[i]);
            }
        }
    },

    _saveToStorage: function() {
        var toStore = [];
        var guide = this.getGuide();
        for (var id in guide)
            toStore.push(guide[id]);
        storage_set("channels", toStore);
    },

};


// Base class representing a channel of photos.
// Concrete constructors must accept a single argument, because Channels.add()
// relies on that.
function Channel() {
    this.__listings = [];
};
Channel.prototype = {
    getListings: function() {
        return this.__listings.slice(0); // shallow copy
    },

    // Update the channel's listings and trigger an 'updated' event.
    refresh: function() {
        var that = this;
        this._getLatestListings(function(listings) {
            that.__listings = listings;
            $(that).trigger("updated");
        });
    },

    // Load all photos so that they're in the cache.
    prefetch: function() {
        this.__listings.forEach(function(listing) {
            setTimeout(function() {
                new Image().src = listing.url;
            }, 0);
        });
    },

    _getLatestListings: function(callback) {
        throw "Implemented by subclass. Call callback with up-to-date listings.";
    }
};


// Channel containing hard coded cats loaded from disk.
// Subclass of Channel.
function AprilFoolsCatsChannel() {
    Channel.call(this);
};
AprilFoolsCatsChannel.prototype = {
    __proto__: Channel.prototype,

    _getLatestListings: function(callback) {
        function L(w, h, f) {
            var folder = chrome.extension.getURL("catblock/pix/");
            return new Listing({
                width: w, height: h, url: folder + f,
                attribution_url: "http://chromeadblock.com/catblock/credits.html",
                title: "This is a cat!"
            });
        }
        // the listings never change
        callback([
            L(270, 256, "5.jpg"),
            L(350, 263, "6.jpg"),
            L(228, 249, "big1.jpg"),
            L(236, 399, "big2.jpg"),
            L(340, 375, "big3.jpg"),
            L(170, 240, "big4.jpg"),
            L(384, 288, "1.jpg"),
            L(132, 91,  "7.jpg"),
            L(121, 102, "9.jpg"),
            L(115, 125, "small1.jpg"),
            L(126, 131, "small2.jpg"),
            L(105, 98,  "small3.jpg"),
            L(135, 126, "small4.jpg"),
            L(133, 108, "small5.jpg"),
            L(120, 99,  "small6.jpg"),
            L(124, 96,  "small7.jpg"),
            L(119, 114, "small8.jpg"),
            L(382, 137, "wide1.jpg"),
            L(470, 102, "wide2.jpg"),
            L(251, 90,  "wide3.jpg"),
            L(469, 162, "wide4.jpg"),
            L(240, 480, "8.jpg"),
            L(103, 272, "tall3.jpg"),
            L(139, 401, "tall4.jpg"),
            L(129, 320, "tall5.jpg"),
            L(109, 385, "tall6.jpg"),
        ]);
    }
};


// Abstract base class for Flickr-based Channels.
// Subclass of Channel.
function FlickrChannel() {
    Channel.call(this);
};
// See http://www.flickr.com/services/api/misc.urls.html Size Suffixes.
// Change this if we want a different size.
FlickrChannel._size = "n"; // 320 on longest side
FlickrChannel.prototype = {
    __proto__: Channel.prototype,

    // Hit the Flickr API |method| passing in |args| with some constants added.
    // Call callback with the resultant JSON if successful.
    _api: function(method, args, callback) {
        var params = {
            api_key: "01bf9d4836f9644c8b8276368388c776",
            method: method,
            license: "4,6,7",  // commercial
            privacy_filter: 1, // no private photos
            safe_search: 1,    // no porn.  Come on, teenagers; grow up.
            content_type: 1,   // photos only, in some API calls
            media: "photos",   // photos only, in other API calls
            extras: "url_" + FlickrChannel._size, // Get URL + height data
            sort: "relevance",
            format: "json",
            nojsoncallback: 1
        };
        $.extend(params, args);
        $.get(
            "https://api.flickr.com/services/rest",
            params,
            function(resp) {
                if (resp && resp.stat == "ok")
                    callback(resp);
            },
            "json"
        );
    },

    // Convert a set of photos from the Flickr API into a list of Listings.
    _toListings: function(photos) {
        var s = FlickrChannel._size;
        var result = [];
        for (var i=0; i < photos.photo.length; i++) {
            var photo = photos.photo[i];
            var listing = new Listing({
                width: photo["width_" + s],
                height: photo["height_" + s],
                url: photo["url_" + s],
                title: photo.title,
                attribution_url: 'http://www.flickr.com/photos/' +
                (photo.owner || photos.owner) + '/' + photo.id
            });
            if (typeof listing.url !== "undefined") {
                result.push(listing);
            }
        }
        return result;
    }
};

// Channel pulling from Flickr search results.
// Subclass of FlickrChannel.
function FlickrSearchChannel(query) {
    FlickrChannel.call(this);
    this._query = query;
};
FlickrSearchChannel.prototype = {
    __proto__: FlickrChannel.prototype,

    _getLatestListings: function(callback) {
        var that = this;
        this._api("flickr.photos.search", { text: this._query }, function(resp) {
            callback(that._toListings(resp.photos));
        });
    }
};

// Channel pulling from a Flickr photoset.
// Subclass of FlickrChannel.
function FlickrPhotosetChannel(photoset_id) {
    FlickrChannel.call(this);
    this._id = photoset_id;
};
FlickrPhotosetChannel.prototype = {
    __proto__: FlickrChannel.prototype,

    // pulls a Flickr Set via API, gets a list of optimum-size photo data
    _getLatestListings: function(callback) {
        var that = this;
        this._api("flickr.photosets.getPhotos", { photoset_id: this._id }, function(resp) {
            callback(that._toListings(resp.photoset));
        });
    }
};

function TheCatsOfCatBlockUsersChannel() {
    FlickrPhotosetChannel.call(this, "72157629665759768");
};

TheCatsOfCatBlockUsersChannel.prototype = {
    __proto__: FlickrPhotosetChannel.prototype
};
