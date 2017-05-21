"use strict";

// Show resourceblock page
$("body").fadeIn();

// Tab was changed, load frames and reload table
$("#tab").on("change", function(event) {
    var tabId = event.target.value;
    showTable(tabId);

    if (tabId === "0") {
        $("#reload").prop("disabled", true);
    } else {
        $("#reload").prop("disabled", false);
    }
});

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

// Reload desired tab
$("#reload").on("click", function() {
    let tabId = $("#tab").val();
    tabId = parseInt(tabId);

    chrome.tabs.reload(tabId);
});

// Convert element type to request type
function reqTypeForElement(elType) {
    switch (parseInt(elType)) {
        case 1: return "script";
        case 2: return "image";
        case 4: return "stylesheet";
        case 8: return "object";
        case 16: return "subdocument";
        case 32: return "object_subrequest";
        case 64: return "other";
        case 128: return "xmlhttprequest";
        case 256: return "document";
        case 512: return "elemhide";
        case 1024: return "popup";
        case 2048: return "ping";
        case 4096: return "media";
        case 8192: return "genericblock";
        case 16384: return "generichide";
        case 32768: return "websocket";
        case 65536: return "font";
        default: return "selector";
    }
}

// Create a new table for a given tabId
function createTable(id) {
    let table = document.querySelector("table[data-tabid='" + id + "']");

    if (table) {
        return;
    }

    // Insert table to page
    $("#searchresources").after(
        "<table data-tabid=" + id + " class='resourceslist'>" +
        "<thead>" +
        "<tr>" +
        "<th data-column='time'>" + translate("catblock_time") + "<\/th>" +
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
}

// Hide all tables and display only the desired one
function showTable(tabId) {
    $("table").hide();
    $("table[data-tabid='" + tabId + "']").css("display", "table");
}

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
            chrome.runtime.onMessage.addListener(function(request, sender) {
                if (request.command !== "send-request") {
                    return;
                }

                // Remove www. from frameDomain in order to detect right filter
                request.data.frameDomain = request.data.frameDomain.replace("www.", "");

                // Find out, where the particular filter comes from
                var filter = request.data.matchData.text;
                var shouldBreak = false;
                if (filter) {
                    if (request.data.elType !== "selector") {
                        for (var filterList in filterLists) {
                            if (shouldBreak) {
                                break;
                            }
                            if (filterList === "malware") {
                                if (filterLists[filterList].text.adware.indexOf(filter) > -1) {
                                    request.data.matchData.filterList = filterList;
                                    shouldBreak = true;
                                    break;
                                }
                            } else {
                                var filterListText = filterLists[filterList].text;
                                for (var i=0; i<filterListText.length; i++) {
                                    var filterls = filterListText[i];
                                    if (filterls === filter) {
                                        if (filterList.startsWith("url:http")) {
                                            request.data.matchData.filterList = filterLists[filterList].title;
                                        } else {
                                            request.data.matchData.filterList = filterList;
                                        }
                                        shouldBreak = true;
                                        break;
                                    }
                                }
                            }
                        }
                    } else {
                        for (var filterList in filterLists) {
                            if (shouldBreak) {
                                break;
                            }
                            // Don't check selector against malware filter list
                            if (filterList === "malware") {
                                continue;
                            }
                            var filterListText = filterLists[filterList].text;
                            for (var i=0; i<filterListText.length; i++) {
                                if (shouldBreak) {
                                    break;
                                }
                                var filter = filterListText[i];
                                // Don't check selector against non-selector filters
                                if (!Filter.isSelectorFilter(filter)) {
                                    continue;
                                }
                                if (filter.endsWith(request.data.url)) {
                                    // If |filter| is global selector filter,
                                    // it needs to be the same as |resource|.
                                    // If it is not the same as |resource|, keep searching for a right |filter|
                                    var filterDomains = filter.split("##")[0];

                                    // Filter is a global selector filter (without any domain prefix)
                                    // E.g.: ###ads
                                    if (filterDomains === "" && filter === request.data.url) {
                                        if (filterList.startsWith("url:http")) {
                                            request.data.matchData.filterList = filterLists[filterList].title;
                                        } else {
                                            request.data.matchData.filterList = filterList;
                                        }
                                        request.data.matchData.text = filter;
                                        shouldBreak = true;
                                        break;
                                    } else {
                                        // Filter is a domain selector filter
                                        // E.g.: somedomain.com###selectors
                                        var frameSubDomains = DomainSet.domainAndParents(request.data.frameDomain);
                                        var filterSubDomains = filterDomains.split(",");

                                        Object.keys(frameSubDomains).forEach(function(frameDomain) {
                                            if (filterSubDomains.indexOf(frameDomain) > -1) {
                                                // Shorten lengthy selector filters
                                                // E.g.: abc.com,xyz.com###selector to xyz.com###selector
                                                if (filterDomains !== "") {
                                                    filter = frameDomain + request.data.url;
                                                }
                                                if (filterList.startsWith("url:http")) {
                                                    request.data.matchData.filterList = filterLists[filterList].title;
                                                } else {
                                                    request.data.matchData.filterList = filterList;
                                                }
                                                request.data.matchData.text = filter;
                                                shouldBreak = true;
                                            }
                                        });
                                    }
                                }
                            }
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
        attr("title", function() {
            if (request.matchData.filterList === "Custom") {
                return translate("filterorigin", translate("catblock_customfilters"));
            } else {
                let text = translate("filter" + request.matchData.filterList);

                // Text may be "", when filter list is a custom one added by an user
                if (text === "") {
                    return translate("filterorigin", request.matchData.filterList);
                } else {
                    return translate("filterorigin", translate("filter" + request.matchData.filterList));
                }
            }
        }).
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
    // and to the ALL requests table
    $("table[data-tabid='" + request.tabId + "'], table[data-tabid='0']").prepend(row);
}

// Fill in frame URLs into frame selector
function prepopulateTabSelect() {
    // Remove all frame options
    $("#tab").find("option").remove();

    chrome.tabs.query({}, function(tabs) {
        // Create an option for every tab
        for (let tab of tabs) {
            if (tab.url === document.location.href) {
                continue;
            }
            createTable(tab.id);
            $("#tab").append($("<option>", { value: tab.id, text: tab.title }));
        }

        // Append a table, where ALL requests will be visible from ALL pages
        $("#tab").prepend($("<option>", { value: 0, text: translate("catblock_allrequests") }));
        createTable(0);

        // Select tab
        $("#tab").val(0);
        $("#tab").change();
    });
}
prepopulateTabSelect();

// When new tab gets opened, create a table for it
// and add it to the tab selector
chrome.tabs.onCreated.addListener(function(tab) {
    createTable(tab.id);
    $("#tab").append($("<option>", { value: tab.id, text: tab.title }));
});

// When title was updated, update it in tab selector as well
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
    if (changeInfo.title) {
        $("option[value='" + tabId + "']").text(changeInfo.title);
    }
});

// When a tab gets closed, remove it from tab selector
chrome.tabs.onRemoved.addListener(function(tabId) {
    $("option[value='" + tabId + "']").remove();
    $("#tab").change();
});

// Remove loading icon
$(".loader").fadeOut();

// Localize page
localizePage();
$(".legendtext").text(translate("legend"));
$("span.blocked").text(translate("blockedresource"));
$("span.whitelisted").text(translate("whitelistedresource"));
$("span.hiding").text(translate("hiddenelement"));

// Show us the legend and search
$("#legend, #note, #tabselect, #searchresources").fadeIn();