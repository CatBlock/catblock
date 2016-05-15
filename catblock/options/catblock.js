// TODO: Star and remove photos in a channel

function mayDelete(channelData) {
    if (channelData.name === "AprilFoolsCatsChannel")
        return false;
    if (channelData.name === "TheCatsOfCatBlockUsersChannel")
        return false;
    return true;
}
function displayName(channelData) {
    var name = channelData.name, param = channelData.param;
    name = name.replace(/Channel$/, '');
    name = name.replace(/([^A-Z])([A-Z])/g, '$1 $2'); // Spaces b/w words
    name = name.replace(/ Block/g, "Block"); // AdBlock, CatBlock...
    if (name === "Flickr Search")
        name = "Flickr search for";
    return name + " <b>" + (param || "") + "</b>";
}
function addEmptyChannelUI(id, data) {
    if (document.getElementById("chan-" + id))
        return;
    var theUI = $("<div>", {
        "class": "channel-ui",
        id: "chan-" + id
    });
    var cb = $("<input>", {
        type: "checkbox",
        click: function() {
            BGcall("setEnabled", id, this.checked);
        },
        checked: data.enabled
    });
    var deleteMe = $("<a>", {
        html: "<sup>x</sup>",
        href: "#",
        click: function() {
            BGcall("removeChannel", id);
            theUI.remove();
            return false;
        },
        css: {
            display: (mayDelete(data) ? undefined : "none")
        }
    });
    var btn = $("<input>", {
        type: "button",
        id: "fill-photos-btn-" + id,
        val: "Preview photos",
        click: function() {
            fillChannelUIWithPhotos(id);
        }
    });
    var title = $("<div>", {id: "chan-" + id + "-title"}).
    append(cb).
    append($("<span>", {
        "class": 'channel-name',
        html: displayName(data)
    })).
    append(deleteMe).
    append(btn);
    var photos = $("<div>", {
        "class": "channel-photos",
        id: "chan-" + id + "-photos",
    });
    theUI.html(title).append(photos).appendTo("#channels");
}

function fillChannelUIWithPhotos(id) {
    $("#fill-photos-btn-" + id).hide();
    BGcall("getListings", id, function(listings) {
        var holder = $("#chan-" + id + "-photos");
        holder.html("");
        holder.show();
        for (var i=0; i < listings.length; i++) {
            var link = $("<a>", {
                href: listings[i].attribution_url,
                target: "_blank"
            });
            $("<img>", {
                src: listings[i].url,
                height: 100,
                id: "chan-" + id + "-listing-" + (i+1) + "-render",
                title: listings[i].title
            }).appendTo(link);
            link.appendTo(holder);
        }
    });
}

function addChannel(name, param) {
    var data = {
        name: name,
        param: param,
        enabled: true
    };
    BGcall("addChannel", data, function(id) {
        if (id) {
            addEmptyChannelUI(id, data);
            $("#flickr-param").val("");
        }
    });
}

BGcall("getGuide", function(guide) {
    for (var id in guide) {
        addEmptyChannelUI(id, guide[id]);
        // TODO: Enable after styling fixes
        //if (guide[id].name === "TheCatsOfCatBlockUsersChannel" &&
        //guide[id].enabled)
        //setMascot(id);
    }
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            if (request.command !== 'channel-updated')
                return;
            var channelUI = $("#chan-" + request.id);
            if ($('#fill-photos-btn-' + request.id).is(":visible"))
                return; // They haven't asked for it yet
            fillChannelUIWithPhotos(request.id);
        }
    );
    $("#btnGo").click(function() {
        var input = $("#flickr-param").val();
        if (/^\W*$/.test(input))
            return;
        if (/^\d+$/.test(input)) {
            addChannel("FlickrPhotosetChannel", input);
            return;
        }
        var match = input.match(/sets\/(\d+)/);
        if (match) {
            addChannel("FlickrPhotosetChannel", match[1]);
            return;
        }
        addChannel("FlickrSearchChannel", input);
    });

});

$('#channel-options input:text').keyup(function(event) {
    if (event.keyCode === 13)
        $(this).next().click();
    // todo handle enter
});

function setMascot(id) {
    BGcall("randomListing", {channelId: id}, function(listing) {
        var folder = "img/";
        $("body").css({
            "background": "url(" + listing.url + ") 95% 5% no-repeat",
            "background-size": "200px",
            "background-attachment": "fixed"
        });
    });
}
