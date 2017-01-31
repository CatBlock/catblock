"use strict";

// Show resourceblock page
$("body").fadeIn();

// Get tabId from URL
var tabId = parseURI.parseSearch(document.location.href).tabId;
tabId = parseInt(tabId);

// Convert element type to request type
function reqTypeForElement(elType) {
    switch (parseInt(elType)) {
        case 1:    return "script";
        case 2:    return "image";
        case 4:    return "stylesheet";
        case 8:    return "object";
        case 16:   return "subdocument";
        case 32:   return "object_subrequest";
        case 64:   return "other";
        case 128:  return "xmlhttprequest";
        case 256:  return "document";
        case 512:  return "elemhide";
        case 1024: return "popup";
        case 2048: return "ping";
        case 4096: return "media";
        default:   return "selector";
    }
}

// Resources search handler
$("#search").on("input", function() {
    let value = $("#search").val();

    $(".resourceslist:visible").find("td[data-column='url']").each(function(index, elem) {
        if (elem.innerText.indexOf(value) === -1) {
            $(elem.parentElement).hide();
        } else {
            $(elem.parentElement).show();
        }
    });
});

// Reset cache for getting matched filter text properly
BGcall("storage_get", "filter_lists", function(filterLists) {
    // TODO: Excluded filters & excluded hiding filters?
    for (var id in filterLists) {
        // Delete every filter list we are not subscribed to
        if (!filterLists[id].subscribed) {
            delete filterLists[id];
            continue;
        }
        // Process malware filter list separately
        if (id !== "malware") {
            filterLists[id].text = filterLists[id].text.split("\n");
        }
    }

    BGcall("get_settings", function(settings) {
        // Process AdBlock's own filters (if any)
        filterLists.AdBlock = {};
        filterLists.AdBlock.text = MyFilters.prototype.getExtensionFilters(settings);

        BGcall("storage_get", "custom_filters", function(filters) {
            // Process custom filters (if any)
            if (filters) {
                filterLists.Custom = {};
                filterLists.Custom.text = FilterNormalizer.normalizeList(filters).split("\n");
            }

            // Find out, whether resource has been blocked/whitelisted,
            // if so, get the matching filter and filter list,
            // where is the matching filter coming from
            chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
                if (request.command !== "send-request") {
                    return;
                }

                //console.log("Request: ", request.data);

                createTable(request.data.tabId);

                // Find out, where the particular filter comes from
                var filter = request.data.matchData.text;
                if (filter) {
                    if (request.data.elType !== "selector") {
                        for (var filterList in filterLists) {
                            if (filterList === "malware") {
                                if (filterLists[filterList].text.adware.indexOf(filter) > -1) {
                                    request.data.matchData.filterList = filterList;
                                }
                            } else {
                                var filterListText = filterLists[filterList].text;
                                for (var i=0; i<filterListText.length; i++) {
                                    var filterls = filterListText[i];
                                    if (filterls === filter) {
                                        request.data.matchData.filterList = filterList;
                                    }
                                }
                            }
                        }
                        if (!request.data.matchData.filterList) {
                            console.log(filterLists.Custom, request.data);
                        }
                    } else {
                        for (var filterList in filterLists) {
                            // Don't check selector against malware filter list
                            if (filterList === "malware") {
                                continue;
                            }
                            var filterListText = filterLists[filterList].text;
                            for (var i=0; i<filterListText.length; i++) {
                                var filter = filterListText[i];
                                // Don't check selector against non-selector filters
                                if (!Filter.isSelectorFilter(filter)) {
                                    continue;
                                }
                                if (filter.indexOf(request.data.url) > -1) {
                                    // If |filter| is global selector filter,
                                    // it needs to be the same as |resource|.
                                    // If it is not the same as |resource|, keep searching for a right |filter|
                                    if ((filter.split("##")[0] === "" && filter === request.data.url) ||
                                        filter.split("##")[0].indexOf(request.data.frameDomain) > -1) {
                                        // Shorten lengthy selector filters
                                        if (filter.split("##")[0] !== "") {
                                            filter = request.data.frameDomain + request.data.url;
                                        }
                                        //res.blockedData = {};
                                        request.data.matchData.filterList = filterList;
                                        //res.blockedData.text = filter;
                                        //res.frameUrl = frame.url;
                                        break;
                                    }
                                }
                            }
                        }
                        if (!request.data.matchData.filterList) {
                            console.log(filterLists.Custom, request.data);
                        }
                    }
                }
                addRequestToTable(request.data);
            });
        });
    });
});

// Add request to the corresponding table
function addRequestToTable(request) {
    // Create a row for each request
    var row = $("<tr>");

    // Add a class according to the request's status
    if (request.elType === "selector") {
        row.addClass("hiding");
    } else {
        if (request.matchData.blocked === true) {
            row.addClass("blocked");
        } else if (request.matchData.blocked === false && request.matchData.text) {
            row.addClass("whitelisted");
        }
    }

    // Cell 1: Time
    $("<td>").
    attr("data-column", "time").
    text(request.time).
    appendTo(row);

    // Cell 2: Type
    $("<td>").
    attr("data-column", "type").
    text(reqTypeForElement(request.elType)).
    appendTo(row);

    // Cell 3: Matching filter
    var cell = $("<td>").
    attr("data-column", "filter");
    if (request.matchData && request.matchData.text && request.matchData.filterList) {
        $("<span>").
        text(request.matchData.text).
        attr("title", translate("filterorigin", translate("filter" + request.matchData.filterList))).
        appendTo(cell);
    }
    row.append(cell);

    // Cell 4: URL
    $("<td>").
    attr("title", request.url).
    attr("data-column", "url").
    text(request.url).
    appendTo(row);

    // Cell 5: third-party or not
    if (request.elType !== "selector") {
        request.thirdParty = BlockingFilterSet.checkThirdParty(new parseURI(request.url).hostname, request.frameDomain);
    }

    var cell = $("<td>").
    text(request.thirdParty ? translate("yes") : translate("no")).
    attr("title", translate("resourcedomain", request.frameDomain)).
    attr("data-column", "thirdparty");
    row.append(cell);

    // Finally, append processed resource to the relevant table
    $("table[data-tabid='" + request.tabId + "']").prepend(row);
}

// Create a new table for a given tabId
function createTable(tabId) {
    let table = document.querySelector("table[data-tabid='" + tabId + "']");

    if (table) {
        return;
    }

    // Insert table to page
    $("#searchresources").after(
        "<table data-tabid=" + tabId + " class='resourceslist'>" +
        "<thead>" +
        "<tr>" +
        "<th data-column='time'>" + "Time" + "<\/th>" +
        "<th data-column='type'>" + translate("headertype") + "<\/th>" +
        "<th data-column='filter'>" + translate("headerfilter") + "<\/th>" +
        "<th data-column='url'>" + translate("headerresource") + "<\/th>" +
        "<th data-column='thirdparty'>" + translate("thirdparty") + "<\/th>" +
        "<\/tr>" +
        "<\/thead>" +
        "<tbody>" +
        "<\/tbody>" +
        "<\/table>"
    );

    $("table[data-tabid='" + tabId + "']").css("display", "table");
}

// Remove loading icon
$(".loader").fadeOut();

// Localize page
localizePage();
$(".legendtext").text(translate("legend"));
$("span.blocked").text(translate("blockedresource"));
$("span.whitelisted").text(translate("whitelistedresource"));
$("span.hiding").text(translate("hiddenelement"));

// Show us the legend and search
$("#legend").fadeIn();
$("#searchresources").fadeIn();