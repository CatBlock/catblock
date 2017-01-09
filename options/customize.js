chrome.runtime.onMessage.addListener(function(request) {
    if (request.command !== "filters_updated") {
        return;
    }
    if ($("#txtFiltersAdvanced").prop("disabled") === false) {
        return;
    }
    BGcall("get_custom_filters_text", function(text) {
        $("#txtFiltersAdvanced").val(text);
    });
    BGcall("get_exclude_filters_text", function(text) {
        $("#txtExcludeFiltersAdvanced").val(text);
    });
    // a call to sendResponse is not needed because of the call in filters.js
});

$(function() {
    //try to get filter syntax page with users language
    //if it fails, default to english (en).
    var syntaxURL = "https://adblockplus.org/" +
        determineUserLanguage() +
        "/filters";

    $.ajax({
        type: "GET",
        url: syntaxURL,
        success: function() {
            $("#tutorlink").attr("href", syntaxURL);
        },
        error: function() {
            $("#tutorlink").attr("href", "https://adblockplus.org/en/filters");
        }
    });

    function saveFilters() {
        var custom_filters_text = $("#txtFiltersAdvanced").val();
        var custom_filters_array = custom_filters_text.split("\n");
        var filterErrorMessage = "";
        $("#messagecustom").html(filterErrorMessage);
        $("#messagecustom").hide();
        for (var i = 0; (!filterErrorMessage && i < custom_filters_array.length); i++) {
            var filter = custom_filters_array[i];
            try {
                FilterNormalizer.normalizeLine(filter);
            } catch(ex) {
                filterErrorMessage = translate("customfilterserrormessage", [filter, ex.message]);
            }
        }
        if (!filterErrorMessage) {
            BGcall("set_custom_filters_text", custom_filters_text);
            updateCustomFiltersCount(custom_filters_text);
            $("#divAddNewFilter").slideDown();
            $("#txtFiltersAdvanced").prop("disabled", true);
            $("#spanSaveButton").hide();
            $("#btnEditAdvancedFilters").show();
            $("#btnCleanUp").show();
        } else {
            $("#messagecustom").html(filterErrorMessage);
            $("#messagecustom").show();
        }
    }

    // Add a custom filter to the list
    function appendCustomFilter(filter) {
        var customFilterText = $("#txtFiltersAdvanced").val();
        $("#txtFiltersAdvanced").val(filter + "\n" + customFilterText);
        saveFilters();
        $(".addControls").slideUp();
    }

    // Convert a messy list of domains to ~domain1.com|~domain2.com format
    function toTildePipeFormat(domainList) {
        domainList = domainList.trim().replace(/[\ \,\;\|]+\~?/g, "|~");
        if (domainList && domainList[0] !== "~") {
            domainList = "~" + domainList;
        }
        return domainList;
    }

    $("#txtBlacklist").focus(function() {
        // Find the blacklist entry in the user's filters, and put it
        // into the blacklist input.
        var customFilterText = $("#txtFiltersAdvanced").val();
        var match = customFilterText.match(/^\@\@\*\$document\,domain\=(\~.*)$/m);
        if (match && $(this).val() === "") {
            $(this).val(match[1]);
        }
    });

    // The add_filter functions
    $("#btnAddUserFilter").click(function() {
        var blockCss = $("#txtUserFilterCss").val().trim();
        var blockDomain = $("#txtUserFilterDomain").val().trim();

        if (blockDomain === ".*" || blockDomain === "*" || blockDomain === "") {
            appendCustomFilter("##" + blockCss);
        } else {
            appendCustomFilter(blockDomain + "##" + blockCss);
        }

        $(this).closest(".entryTable").find("input[type='text']").val("");
        $(this).prop("disabled", true);
    });

    $("#btnAddExcludeFilter").click(function() {
        var excludeUrl = $("#txtUnblock").val().trim();

        // Prevent regexes
        if (/^\/.*\/$/.test(excludeUrl)) {
            excludeUrl = excludeUrl + "*";
        }

        appendCustomFilter("@@" + excludeUrl + "$document");

        $(this).closest(".entryTable").find("input[type='text']").val("");
        $(this).prop("disabled", true);
    });

    $("#btnAddBlacklist").click(function() {
        var blacklist = toTildePipeFormat($("#txtBlacklist").val());

        var filters = $("#txtFiltersAdvanced").val().trim() + "\n";
        // Delete the first likely line
        filters = filters.replace(/^\@\@\*\$document,domain\=~.*\n/m, "").trim();
        $("#txtFiltersAdvanced").val(filters);
        // Add our line in its place, or if it was empty, remove the filter
        if (blacklist) {
            appendCustomFilter("@@*$document,domain=" + blacklist);
        } else {
            saveFilters(); // just record the deletion
        }

        $("#btnAddBlacklist").prop("disabled", true);
    });

    $("#btnAddUrlBlock").click(function() {
        var blockUrl = $("#txtBlockUrl").val().trim();
        var blockDomain = $("#txtBlockUrlDomain").val().trim();
        if (blockDomain === "*") {
            blockDomain = "";
        }

        //prevent regexes
        if (/^\/.*\/$/.test(blockUrl)) {
            blockUrl = blockUrl + "*";
        }

        if (blockDomain === "") {
            appendCustomFilter(blockUrl);
        } else {
            appendCustomFilter(blockUrl + "$domain=" + blockDomain);
        }

        $(this).closest(".entryTable").find("input[type='text']").val("");
        $(this).prop("disabled", true);
    });

    // The validation functions
    $("#txtBlacklist").on("input", function() {
        var blacklist = toTildePipeFormat($("#txtBlacklist").val());

        if (blacklist) {
            blacklist = "@@*$document,domain=" + blacklist;
        }
        var filterErrorMessage = "";
        $("#messageBlacklist").html(filterErrorMessage);
        $("#messageBlacklist").hide();
        try {
            FilterNormalizer.normalizeLine(blacklist);
            $("#btnAddBlacklist").prop("disabled", false);
        } catch(ex) {
            $("#btnAddBlacklist").prop("disabled", true);
            filterErrorMessage = translate("customfilterserrormessage", [$("#txtBlacklist").val(), ex.message]);
            $("#messageBlacklist").html(filterErrorMessage);
            $("#messageBlacklist").show();
        }
    });

    $("#divUrlBlock input[type='text']").on("input", function() {
        var blockUrl = $("#txtBlockUrl").val().trim();
        var blockDomain = $("#txtBlockUrlDomain").val().trim();
        if (blockDomain === "*") {
            blockDomain = "";
        }
        if (blockDomain) {
            blockDomain = "$domain=" + blockDomain;
        }
        var ok = false;
        try {
            if (FilterNormalizer.normalizeLine(blockUrl + blockDomain)) {
                ok = true;
            }
            if (Filter.isSelectorFilter(blockUrl)) {
                ok = false;
            }
        } catch(ex) {}
        $("#btnAddUrlBlock").prop("disabled", ok ? null : true);
    });

    $("#divCssBlock input[type='text']").on("input", function() {
        var blockCss = $("#txtUserFilterCss").val().trim();
        var blockDomain = $("#txtUserFilterDomain").val().trim();
        if (blockDomain === "*") {
            blockDomain = "";
        }
        var ok = false;
        try {
            if (FilterNormalizer.normalizeLine(blockDomain + "##" + blockCss)) {
                ok = true;
            }
        } catch(ex) {}
        $("#btnAddUserFilter").prop("disabled", ok ? null : true);
    });

    $("#divExcludeBlock input[type='text']").on("input", function() {
        var unblockUrl = $("#txtUnblock").val().trim();
        var ok = false;
        try {
            if (FilterNormalizer.normalizeLine("@@" + unblockUrl + "$document")) {
                ok = true;
            }
            if (!unblockUrl || Filter.isSelectorFilter(unblockUrl)) {
                ok = false;
            }
        } catch(ex) {}
        $("#btnAddExcludeFilter").prop("disabled", ok ? null : true);
    });

    // When one presses 'Enter', pretend it was a click on the 'add' button
    $(".entryTable input[type='text']").keypress(function(event) {
        var submitButton = $(this).closest(".entryTable").find("input[type='button']");
        if (event.keyCode === 13 && !submitButton.prop("disabled")) {
            event.preventDefault();
            submitButton.click();
        }
    });

    $("a.controlsLink").click(function(event) {
        event.preventDefault();
        var myControls = $(this).closest("div").find(".addControls");
        $(".addControls").not(myControls).slideUp();
        myControls.slideToggle();
    });

    $("#btnEditAdvancedFilters").click(function() {
        $("#divAddNewFilter").slideUp();
        $(".addControls").slideUp();
        $("#txtFiltersAdvanced").prop("disabled", false);
        $("#spanSaveButton").show();
        $("#btnEditAdvancedFilters").hide();
        $("#txtFiltersAdvanced").focus();
    });

    $("#btnEditExcludeAdvancedFilters").click(function() {
        $("#divAddNewFilter").slideUp();
        $(".addControls").slideUp();
        $("#txtExcludeFiltersAdvanced").removeAttr("disabled");
        $("#spanSaveExcludeButton").show();
        $("#btnEditExcludeAdvancedFilters").hide();
        $("#txtExcludeFiltersAdvanced").focus();
    });

    // Update custom filter count in the background.
    // Inputs: custom_filters_text:string - string representation of the custom filters
    // delimited by new line.
    function updateCustomFiltersCount(custom_filters_text) {
        var custom_filters_array = custom_filters_text.split("\n");
        var new_count = {};
        var temp_filter_tracker = [];
        for (var i = 0; i < custom_filters_array.length; i++) {
            var filter = custom_filters_array[i];
            //Check if filter is a duplicate and that it is a hiding filter.
            if (temp_filter_tracker.indexOf(filter) < 0 && filter.indexOf("##") > -1) {
                temp_filter_tracker.push(filter);
                var host = filter.split("##")[0];
                new_count[host] = (new_count[host] || 0) + 1;
            }
        }
        BGcall("updateCustomFilterCountMap", new_count);
    }

    $("#btnSaveAdvancedFilters").click(saveFilters);

    function saveExcludeFilters() {
        var exclude_filters_text = $("#txtExcludeFiltersAdvanced").val();
        BGcall("set_exclude_filters", exclude_filters_text, function() {
            $("#divAddNewFilter").slideDown();
            $("#txtExcludeFiltersAdvanced").attr("disabled", "disabled");
            $("#spanSaveExcludeButton").hide();
            $("#btnEditExcludeAdvancedFilters").show();
            BGcall("get_exclude_filters_text", function(text) {
                $("#txtExcludeFiltersAdvanced").val(text);
                if (text) {
                    $("#divExcludeFilters").show();
                }
            });
        });

    }
    $("#btnSaveExcludeAdvancedFilters").click(saveExcludeFilters);

    BGcall("get_custom_filters_text", function(text) {
        $("#txtFiltersAdvanced").val(text);
    });

    BGcall("get_settings", function(settings) {
        if (settings.show_advanced_options &&
            !settings.safari_content_blocking) {
            $("#divExcludeFilters").show();
        }
        if (settings.safari_content_blocking) {
            $("#safariwarning").text(translate("contentblockingwarning")).show();
        }
    });

    BGcall("get_exclude_filters_text", function(text) {
        $("#txtExcludeFiltersAdvanced").val(text);
        if (text) {
            $("#divExcludeFilters").show();
        }
    });

    $("#btnCleanUp").click(function() {
        //Don't save immediately, first allow them to review changes
        if ($("#btnEditAdvancedFilters").is(":visible")) {
            $("#btnEditAdvancedFilters").click();
        }
        var newFilters = FilterNormalizer.normalizeList($("#txtFiltersAdvanced").val(), true);
        newFilters = newFilters.replace(/(\n)+$/,"\n"); // Del trailing \n's
        $("#txtFiltersAdvanced").val(newFilters);
    });
});