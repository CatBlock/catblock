// The options that can be specified on filters.  The first several options
// specify the type of a URL request.
var ElementTypes = {
    NONE: 0,
    script: 1,
    image: 2,
    stylesheet: 4,
    object: 8,
    subdocument: 16,
    object_subrequest: 32,
    other: 64,
    xmlhttprequest: 128,
    document: 256,
    elemhide: 512,
    popup: 1024,
    ping: 2048,
    media: 4096,
    genericblock: 8192,
    generichide: 16384,
    websocket: 32768,
    font: 65536
    // If you add something here, update .DEFAULTTYPES and .CHROMEONLY below.
};
// The types that are implied by a filter that doesn't explicitly specify types
ElementTypes.DEFAULTTYPES = 1023;
// Add here any types that Safari does not support.
ElementTypes.CHROMEONLY = (ElementTypes.object_subrequest | ElementTypes.other |
                           ElementTypes.xmlhttprequest | ElementTypes.genericblock |
                           ElementTypes.generichide | ElementTypes.ping | ElementTypes.websocket);

// Convert a webRequest.onBeforeRequest type to an ElementType.
ElementTypes.fromOnBeforeRequestType = function(type) {
    switch (type) {
        case "main_frame": return ElementTypes.document;
        case "sub_frame": return ElementTypes.subdocument;
        case "beacon": return ElementTypes.ping;
        case "imageset": return ElementTypes.image;
        default: return ElementTypes[type] || ElementTypes.other;
    }
};

var FilterOptions = {
    NONE: 0,
    THIRDPARTY: 1,
    MATCHCASE: 2,
    FIRSTPARTY: 4
};