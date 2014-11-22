var resources = {};
var custom_filters = {};
var chosenResource = {};
var local_filtersets = {};

// Creates the table that shows all blockable items
function generateTable() {
  // Truncates a resource URL if it is too long. Also escapes some
  // characters when they have a special meaning in HTML.
  // Inputs: the string to truncate
  // Returns the truncated string
  function truncateI(j) {
    if (j.length > 90)
      if (j.indexOf('?') > 43 && j.indexOf('?') <= 85)
        j = j.substring(0, j.indexOf('?') + 1) + '[...]';
    if (j.length > 90)
      j = j.substring(0, 86) + '[...]';

    return j;
  }

  // Now create that table row-by-row
  var rows = [];
  for (var i in resources) {
    var matchingfilter = resources[i].filter;
    var matchingListID = "", matchingListName = "";
    var typeName = getTypeName(resources[i].type);

    if (matchingfilter) {
      // If matchingfilter is already set, it's a hiding rule or a bug.
      // However, we only know the selector part (e.g. ##.ad) not the full
      // selector (e.g., domain.com##.ad). Neither do we know the filter list
      for (var fset in local_filtersets) {
        // Slow? Yeah, for sure! But usually you have very few hiding rule
        // matches, not necessary for the same domain. And we can be slow in
        // resourceblock, so there is no need to cache this.
        var hidingset = local_filtersets[fset].hiding;
        var hidingrules = hidingset.filtersFor(resources[i].domain, true);
        if (hidingrules.indexOf(matchingfilter.substr(2)) !== -1) {
          var subdomain = resources[i].domain;
          var k = 0;
          while (subdomain) {
            k++; if (k>100) break;
            if (hidingset.items[subdomain]) {
              for (var j=0; j<hidingset.items[subdomain].length; j++) {
                if (hidingset.items[subdomain][j].selector === matchingfilter.substr(2)) {
                  // Ignore the case that a list contains both
                  // ##filter
                  // ~this.domain.com,domain.com##filter
                  matchingfilter = hidingset.items[subdomain][j]._text;
                }
              }
            }
            if (subdomain === "global") {break;}
            subdomain = subdomain.replace(/^.+?(\.|$)/, '') || "global";
          }
          matchingListID = fset;
          break;
        }
      }
    } else {
      for (var fset in local_filtersets) {
        var currentlist_matchingfilter = local_filtersets[fset].blocking.
              matches(i, resources[i].type, resources[i].domain, true);
        if (currentlist_matchingfilter) {
          matchingListID = fset;
          matchingfilter = currentlist_matchingfilter;
          if (Filter.isWhitelistFilter(currentlist_matchingfilter))
            break;
        }
      }
    }

    if (matchingListID) {
      if (matchingListID === "user_custom_filters") {
        matchingListName = translate("tabcustomize");
      } else if (matchingListID === "build_in_filters") {
        matchingListName = "AdBlock";
      } else {
        matchingListName = translate("filter" + matchingListID);
        if (!matchingListName) {
          matchingListName = matchingListID.substr(4);
          validateUrl(matchingListName);
        }
      }
    }

    var type = {sort:3, name:undefined};
    if (matchingfilter) {
      if (Filter.isWhitelistFilter(matchingfilter))
        type = {sort:2, name:'whitelisted'};
      else if (Filter.isSelectorFilter(i)) {
        // TODO: report excluded hiding rules
        type = {sort:0, name:'hiding'};
      } else
        type = {sort:1, name:'blocked'};
    } else {
      matchingfilter = "";
    }

    // TODO: When crbug 80230 is fixed, allow $other again
    var disabled = (typeName === 'other' || typeName === 'unknown');

    // We don't show the page URL unless it's excluded by $document or $elemhide
    if (typeName === 'page' && !matchingfilter)
      continue;

    var row = $("<tr>");
    if (type.name)
      row.addClass(type.name);

    // Cell 1: Checkbox
    var cell = $("<td><input type='checkbox'/></td>").css("padding-left", "4px");
    if (disabled)
      cell.find("input").prop("disabled", true);
    row.append(cell);

    // Cell 2: URL
    $("<td>").
      attr("title", i).
      attr("data-column", "url").
      text(truncateI(i)).
      appendTo(row);

    // Cell 3: Type
    $("<td>").
      attr("data-column", "type").
      css("text-align", "center").
      text(translate('type' + typeName)).
      appendTo(row);

    // Cell 4: hidden sorting field and matching filter
    cell = $("<td>").
      attr("data-column", "filter").
      css("text-align", "center");
    $("<span>").
      addClass("sorter").
      text(type.name ? type.sort : 3).
      appendTo(cell);
    if (type.name)
      $("<span>").
        text(truncateI(custom_filters[matchingfilter] || matchingfilter)).
        attr('title', translate("filterorigin", matchingListName)).
        appendTo(cell);
    row.append(cell);
    resources[i].filter = matchingfilter;
    resources[i].filterlist = matchingListName;

    // Cell 5: third-party or not
    var resourceDomain = parseUri(i).hostname;
    var isThirdParty = (type.name === 'hiding' ? false :
        BlockingFilterSet.checkThirdParty(resources[i].domain, resourceDomain));
    cell = $("<td>").
        text(isThirdParty ? translate('yes') : translate('no')).
        attr("title", translate("resourcedomain", resources[i].domain || resourceDomain)).
        attr("data-column", "thirdparty").
        css("text-align", "center");
    row.append(cell);
    resources[i].isThirdParty = isThirdParty;
    resources[i].resourceDomain = resourceDomain;

    // Cells 2-5 may get class=clickableRow
    if (!disabled)
      row.find("td:not(:first-child)").addClass("clickableRow");

    // Cell 6: delete a custom filter
    if (custom_filters[matchingfilter])
      $("<td>").
        addClass("deleterule").
        attr("title", translate("removelabel")).
        appendTo(row);
    else
      $("<td>").appendTo(row);

    rows.push(row);
  }
  if (!rows.length) {
    alert(translate('noresourcessend2'));
    self.close();
    return;
  }
  $("#loading").remove();
  $("#resourceslist tbody").empty();
  for (var i = 0; i < rows.length; i++) {
    $("#resourceslist tbody").append(rows[i]);
  }
  // Make it sortable, initial sort sequence is first the filter column (4),
  // then the URL column (2)
  $("#resourceslist th:not(:empty)").click(sortTable);
  $("#resourceslist th[data-column='url']").click();
  $("#resourceslist th[data-column='filter']").click();

  $(".deleterule").click(function() {
    var resource = resources[$(this).prevAll('td[data-column="url"]')[0].title];
    BGcall('remove_custom_filter', custom_filters[resource.filter], function() {
      // If the filter was a hiding rule, it'll still show up since it's still in
      // frameData in the background. However, I consider that acceptable.
      if (getTypeName(resource.type) === "page") {
        alert(translate("excludefilterremoved"));
        window.close();
      } else
        document.location.reload();
    });
  });
}

// Hide "change" button, when no item has been selected
$(document).ready(function() {
 $("#choosedifferentresource").css("opacity", "0");
});

// Converts the ElementTypes number back into an readable string
// or hiding or 'unknown' if it wasn't in ElementTypes.
// Inputs: One out of ElementTypes or 'undefined'
// Returns a string with the element type
function getTypeName(type) {
  switch(type) {
    case undefined: return "hiding";
    case ElementTypes.script: return "script";
    case ElementTypes.background:
    case ElementTypes.image: return "image";
    case ElementTypes.stylesheet: return "stylesheet";
    case ElementTypes.object: return "object";
    case ElementTypes.subdocument: return "subdocument";
    case ElementTypes.object_subrequest: return "object_subrequest";
    case ElementTypes.media: return "media";
    case ElementTypes.xmlhttprequest: return "xmlhttprequest";
    case ElementTypes.other: return "other";
    //Cheating with $document & $elemhide here to make it easier: they are considered 'the same'
    case ElementTypes.document | ElementTypes.elemhide: return "page";
    case ElementTypes.popup: return "popup";
    default: return "unknown";
  }
}

//Generate a list of pre-defined url filters
function generateFilterSuggestions() {
  var url = chosenResource.resource;
  url = url.replace(/\s{5}\(.*\)$/, '').replace(/\#.*$/, '');
  var isBlocked = ($(".selected").hasClass("blocked"));
  var isHidden = ($(".selected").hasClass("hiding"));
  var blocksuggestions = [];
  var strippedUrl = url.replace(/^[a-z\-]+\:\/\/(www\.)?/, '');
  blocksuggestions.push(strippedUrl);
  if (strippedUrl.indexOf("?") > 0 || strippedUrl.indexOf("#") > 0) {
    strippedUrl = strippedUrl.replace(/(\?|\#).*/, '');
    blocksuggestions.push(strippedUrl);
  }
  if (strippedUrl.indexOf("/") > 0 &&
      strippedUrl.lastIndexOf('/') !== strippedUrl.indexOf('/')) {
    strippedUrl = strippedUrl.substr(0, strippedUrl.lastIndexOf('/') + 1);
    blocksuggestions.push(strippedUrl);
  }
  if (strippedUrl.indexOf('/') > 0) {
    strippedUrl = strippedUrl.substr(0, strippedUrl.indexOf('/'));
    blocksuggestions.push(strippedUrl);
  }

  var minimumdomain = parseUri.secondLevelDomainOnly(strippedUrl, true);
  if (minimumdomain !== strippedUrl) {
    blocksuggestions.push(minimumdomain);
  }

  var suggestions = [];
  for (var i in blocksuggestions) {
    var inputBox = $("<input>").
      attr("type", "radio").
      attr("name", "urloption").
      attr("id", "suggest_" + i).
      val((isBlocked ? "@@||" : "||") + blocksuggestions[i]);
    var label = $("<label>").
      attr("for", "suggest_" + i).
      text(blocksuggestions[i]);
    suggestions.push(inputBox);
    suggestions.push(label);
    suggestions.push("<br/>");
  }

  $("#suggestions").empty();
  for (var i = 0; i < suggestions.length; i++)
    $("#suggestions").append(suggestions[i]);
  if (isHidden)
    $("#disable").find('input').prop('checked', true);
  else if ($("#suggestions").find('input:first-child').val().indexOf('?') > 0)
    $($("#suggestions").children('input')[1]).prop('checked', true);
  else
    $("#suggestions").find('input:first-child').prop('checked', true);

  if (!isBlocked && !isHidden)
    $("#status").text(translate("blockeverycontaining"));
  else if (isHidden)
    $("#status").text(translate("thisfilterwillbedisabled"));
  else
    $("#status").text(translate("whitelisteverycontaining"));

  $("label[for='disablefilter']").text(chosenResource.filter);

  var inputBox = $('<input>').
    attr("type", "text").
    attr("id", "customurl").
    attr("size", "99").
    attr("title", translate("wildcardhint")).
    val(url).
    bind("input", function() {
      $("#custom").click();
    });
  $("#custom + label").append(inputBox);
}

// Create filtersets for resourceblock and put them in the local_filtersets
// object. Similar to MyFilters.prototype.rebuild(), but keeps every list
// separate. Inputs
//   id: identifier of the list
//   text: array containing all filters in the list
function createResourceblockFilterset(id, text) {
  local_filtersets[id] = {};
  var w = {}, b = {}, h = {};

  for (var i=0; i<text.length; i++) {
    var filter = Filter.fromText(text[i]);
    if (Filter.isSelectorFilter(text[i]))
      h[filter.id] = filter;
    else if (Filter.isWhitelistFilter(text[i]))
      w[filter.id] = filter;
    else if (text[i])
      b[filter.id] = filter;
  }
  local_filtersets[id].hiding = FilterSet.fromFilters(h);
  local_filtersets[id].blocking =
    new BlockingFilterSet(FilterSet.fromFilters(b), FilterSet.fromFilters(w));
}

// Check an URL for it's validity
function validateUrl(url) {
  if (!/^https?:\/\//.test(url)) {
    window.close();
    return;
  }
}

// Create the filter that will be applied from the chosen options
// Returns the filter
function createfilter() {
  var matchedfilter = $("label[for='disablefilter']").text();
  var isBlocked = ($(".selected").hasClass("blocked"));
  var isHidden = ($(".selected").hasClass("hiding"));
  var filterwithoutdomain = '';
  var urlfilter = '';

  if ($('#selectblockableurl #customurl').length) {
    urlfilter = (isBlocked ? '@@' : '') + $('#customurl').val();
  } else if ($('#selectblockableurl label[for="disablefilter"]').length) {
    if (isBlocked) {
      urlfilter = '@@' + matchedfilter;
    } else if (isHidden) {
      var chosenfilter = chosenResource.filter.replace('##', '#@#');
      var domain = chosenfilter.substr(0, chosenfilter.lastIndexOf("#@"));
      filterwithoutdomain = chosenfilter.replace(domain,"");
      if (domain === "") {
        urlfilter = chosenfilter;
      } else {
        urlfilter = filterwithoutdomain;
      }
    } else {
      urlfilter = matchedfilter;
    }
  } else {
    urlfilter = $('#selectblockableurl input').val();
  }

  if ((/^(\@\@)?\/.*\/$/).test(urlfilter))
    urlfilter += '*';

  var options = [];
  var selector = "#chooseoptions > input:checked";
  if ($("#types > input:not(:checked):not(.implicitType)").length ||
      $("#types > input.implicitType:checked").length)
    selector += ", #types > input:checked";
  $(selector).each(function() {
    if ($(this).val())
      options.push($(this).val());
  });

  var option = '';
  if (options.length && !($("#disablefilter").is(":disabled"))) {
    option = '$' + options.join(',');
  } else if (options.length && $("#disablefilter").is(":disabled")) {
    if (urlfilter.indexOf('$') !== -1 ) {
      option = ',' + options.join(',')
    } else if (!isHidden) {
      option = '$' + options.join(',');
    }
    if (isHidden) {
      var chosenfilter = chosenResource.filter;
      urlfilter = chosenResource.domain + filterwithoutdomain;
      option = '';
    }
  } else {
    option = '';
  }
  return urlfilter + option;
}

// Checks if the text in the domain list textbox is valid or not
// Inputs: the text from the text box
// Returns true if the domain list was valid, false otherwise
function isValidDomainList(text) {
  if (!text)
    return false;
  try {
    var parsedDomains = Filter._domainInfo(text, "|");
    FilterNormalizer.verifyDomains(parsedDomains);
    return true;
  } catch(ex) {
    return false;
  }
}

// Checks if a resource matches a filter, and if not, it asks the user if this
// is correct and returns the answer
// Inputs: filter: the filter to test the match against
//         url: the resource URL
//         type: the resource type
//         domain: the resource domain
// Returns: boolean: should it continue?
function filterMatchesResource(filter, url, type, domain) {
  var temp_filterset = new BlockingFilterSet(
                        FilterSet.fromFilters({1: Filter.fromText(filter) }),
                        FilterSet.fromFilters({}));
  if (!temp_filterset.matches(url, type, domain))
    return confirm(translate("doesntmatchoriginal"));
  return true;
}

// After getting annoyed by the time it takes to get the required data
// finally start generating some content for the user, and allowing him to
// do some things, instead of looking at 'LOADING'
function finally_it_has_loaded_its_stuff() {
  // Create the table of resources
  generateTable();

  // Add another background color when hovering
  $("#resourceslist tbody tr").mouseenter(function() {
    if ($(this).hasClass('selected'))
      return;
    $(this).children(":not(:first-child)").
      css("-webkit-transition", "all 0.3s ease-out").
      css("background-color", "rgba(242, 242, 242, 0.3)");
  });
  $("#resourceslist tr").mouseleave(function() {
    $(this).children().
      css("-webkit-transition", "all 0.3s ease-out").
      css("background-color", "white");
  });

  // Make legend draggable
  $(function() {
    $("#legend").draggable();
  });

  // Close the legend
  $(".closelegend").click(function() {
    $("#legend").remove();
  });

  // Search a resource
  $('#search').bind("search", function() {
    var patterns = $("#search").val().trim().replace(/\s+/g, ' ').split(" ");
    for (var i=0; i<patterns.length; i++) {
      patterns[i] = new RegExp(patterns[i]
                      .replace(/\*+/g, '*')
                      .replace(/\W/g, '\\$&')
                      .replace(/\\\*/g, '[^\\t]*'), "i");
    }
    $("#resourceslist tbody tr.noSearchMatch").removeClass("noSearchMatch");
    $("#nosearchresults").remove();
    if (!$("#search").val().trim()) return;
    $("#resourceslist tbody tr").each(function(i,el) {
      var keywords = [];
      var res = resources[$("[data-column='url']", el).attr('title')];
      keywords.push(res.domain);
      keywords.push(res.resource);
      if (res.filter) {
        keywords.push(res.filter);
        if (custom_filters[res.filter] !== res.filter)
          keywords.push(custom_filters[res.filter]);
      }
      if (res.filterlist)
        keywords.push(res.filterlist);
      var typeName = getTypeName(res.type);
      keywords.push(typeName);
      if (/_/.test(typeName))
        keywords.push(typeName.replace('_', '-')); // $object-subrequest === $object_subrequest
      keywords.push(translate("type" + typeName));
      if (res.isThirdParty) {
        keywords.push(translate("thirdparty"));
        keywords.push("third-party");
        keywords.push("third_party");
      } else {
        // There are so many possible ways to call 'first-party' resources, that
        // I'm not going to worry about those (localized) matches.
        keywords.push("first-party");
        keywords.push("first_party");
      }
      keywords = keywords.join('\t');
      for (var j=0; j<patterns.length; j++) {
        if (!patterns[j].test(keywords)) {
          // Setting styles directly is terribly slow. Using classes is way faster.
          $(el).addClass("noSearchMatch");
          break;
        }
      }
    });
    if ($("#resourceslist tbody tr:visible").length === 0) {
      $("#resourceslist tbody").
        append("<tr id='nosearchresults'>" +
              "<td colspan='6'>" + translate("nosearchresults") + "</td></tr>");
    }
  });

  // Auto-scroll to the bottom of the page
  $("#confirmUrl").click(function(event) {
    event.preventDefault();
    $("html, body").animate({ scrollTop: 15000 }, 50);
  });

  // An item has been selected
  $('.clickableRow, input:enabled', '#resourceslist').click(function() {
    if ($('.selected','#resourceslist').length > 0)
      return; //already selected a resource
    $("#choosedifferentresource").css("opacity", "1");
    $("#choosedifferentresource").click(function() {
      document.location.reload();
    });
    $(this).parents('tr').addClass('selected');
    $("#resourceslist tr:not(.selected)").remove();
    $("#resourceslist tr input").
      prop('checked', true).
      prop('disabled', true);
    $('.clickableRow').removeClass('clickableRow');
    $('#legend').remove();
    chosenResource = resources[$(".selected td[data-column='url']").prop('title')];
    $(".selected td[data-column='thirdparty']").text(
                    chosenResource.isThirdParty ? translate('thirdparty') : '');

    // Show the 'choose url' area
    $("#selectblockableurl").fadeIn();
    $("#resourceslist tbody tr td").css("background-color", "white");

    var isBlocked = ($(".selected").hasClass("blocked"));
    var isHidden = ($(".selected").hasClass("hiding"));
    var isWhitelisted = ($(".selected").hasClass("whitelisted"));
    if (isBlocked || isWhitelisted) {
      $("#disable").css("display","block");
      $("#confirmUrl").before("<br>");
    } else if (isHidden) {
      $("#disable").css("display","block");
      $("#selectblockableurl br").remove();
      $("[i18n='ordisablefilter'], #suggestions, #custom, label[for='custom']").remove();
      $("[i18n='blockeverycontaining']").attr("i18n","thisfilterwillbedisabled");
      $("#confirmUrl").before("<br>");
    } else {
      $("#disable").css("display","none");
    }

    generateFilterSuggestions();
    // If the user clicks the 'next' button
    $("#confirmUrl").click(function() {
      if ($('#custom').is(':checked') &&
          $('#customurl').val().trim() === '') {
        alert(translate('novalidurlpattern'));
        return;
      }
      if ($('#custom').is(':checked')) {
        var custom_corrected = $('#customurl').val().
                                 replace(/\s/g, '').replace(/^\@\@/, '');
        // Check the URL only, therefore type image, so we don't end up with for
        // example 'popup', a non-default type.
        if (!filterMatchesResource(custom_corrected, chosenResource.resource,
                                     ElementTypes.image, chosenResource.domain))
          return;

        // Remove preceeding @@ and trailing spaces
        $('#customurl').val(custom_corrected);
      }

      // Hide unused stuff
      $("#selectblockableurl input[type='radio']:not(:checked) + label").remove();
      $("#selectblockableurl input[type='radio']:not(:checked)").remove();
      $("#confirmUrl").next().remove();
      $("#confirmUrl").remove();
      $("#selectblockableurl br").remove();
      $("#selectblockableurl *:not(br):not(b)").prop("disabled", true);
      if ($("#disablefilter").is(":disabled")) {
        $("#status").text(translate("thisfilterwillbedisabled"));
        $("label[for='domainis']").text(translate("onlypagesonthisdomain"));
        $("[i18n='appliedwhenbrowsing']").text(translate("disabledwhenbrowsing"));
        $("[i18n='ordisablefilter'], [i18n='casesensitive'], [i18n='onlyresourcetypes'], [id^='matchcase'], [for^='matchcase'], #chooseoptions br, #suggestions, #thirdparty, #types").remove();
        $("#onEverySite, #domainis").before("<br>");
        $("#addthefilter").before("<br><br>");
      } else {
        $("[i18n='ordisablefilter'], #suggestions br").remove();
      }

      // Show the options
      $("#chooseoptions").fadeIn();
      var isThirdParty = chosenResource.isThirdParty;
      if (!isThirdParty) {
        $("#thirdparty + * + *, #thirdparty + *, #thirdparty").remove();
      } else {
        // Use .find().text() so data from query string isn't injected as HTML
        $("#thirdparty + label").
          html(translate("thirdpartycheckbox", "<i></i>")).
          find("i").
          text(parseUri.secondLevelDomainOnly(chosenResource.resourceDomain, true));
      }

      $("#domainlist").
        val(chosenResource.domain.replace(/^www\./, '')).
        click(function() {
          $("#domainis").prop("checked", true);
          $("#filterpreview").text(createfilter());
        }).
        bind("input", function() {
          $("#domainis").prop("checked", true);
          $(this).trigger("keyup");
        }).
        keyup(function() {
          if (isValidDomainList($(this).val().trim().replace(/(\s|\,|\;)+/g, '|'))){
            $("#domainis").
              val('domain=' + $(this).val().trim().replace(/(\s|\,|\;)+/g, '|'));
            $("#domainlist").css('color', 'black');
          } else {
            $("#domainis").val('');
            $("#domainlist").css('color', 'red');
          }
          $("#filterpreview").text(createfilter());
        });
      $("#domainis").
        val('domain=' + chosenResource.domain.replace(/^www\./, ''));

      var selectorForFixedType = '[value="' + getTypeName(chosenResource.type) +  '"]';
      if (!$(selectorForFixedType).is(":checked")) {
        // Special non-default type. For example $popup
        $("#types > input").prop("checked", false);
      }
      $(selectorForFixedType).
          prop('disabled', true).
          prop('checked', true);

      // Update the preview filter
      $("#chooseoptions *").change(function() {
        $("#filterpreview").text(createfilter());
      });
      $("#filterpreview").text(createfilter());

      // Add the filter
      $("#addthefilter").click(function() {
        var generated_filter = createfilter();
        if (!isHidden && !filterMatchesResource(generated_filter, chosenResource.resource,
                                    chosenResource.type, chosenResource.domain))
          return;
        if (!isHidden && !isBlocked && isWhitelisted) {
            BGcall("add_exclude_filter", generated_filter, function(ex) {
                if (!ex) {
                    alert(translate("filterhasbeenadded"));
                    window.close();
                } else {
                    alert(translate("blacklistereditinvalid1", ex));
                }
            });
        } else {
            BGcall('add_custom_filter', generated_filter, function(ex) {
                if (!ex) {
                    alert(translate("filterhasbeenadded"));
                    window.close();
                } else {
                    alert(translate("blacklistereditinvalid1", ex));
                }
            });
        }
      });
    });
  });
}

$(function() {
  // Translation
  localizePage();
  var url;
  if (window.location.search) {
    // Can be of the forms
    //  ?url=(page url)&itemType=(someElementType)&itemUrl=(item url)
    //  ?tabId=(tab ID)
    var qps = parseUri.parseSearch(window.location.search);
    function validateItemType(itemType) {
      if (!ElementTypes[itemType]) {
        window.close();
        return;
      }
    }
    if (qps.url) {
      url = qps.url;
      validateUrl(url);
    }
    if (qps.tabId && isNaN(qps.tabId)) {
      window.close();
      return;
    }
    if (qps.itemType) {
      var itemUrl = qps.itemUrl;
      validateUrl(itemUrl);
      validateItemType(qps.itemType);

      resources[itemUrl] = {
        type: ElementTypes[qps.itemType],
        domain: parseUri(url).hostname,
        resource: itemUrl
      };
    }
  }


  var opts = {
    domain: parseUri(url || "x://y/").hostname
  };
  BGcall('storage_get', 'filter_lists', function(filter_lists) {

    for (var id in filter_lists) {
      if (filter_lists[id].subscribed) {
        createResourceblockFilterset(id, filter_lists[id].text.split('\n'));
      }
    }

    BGcall('get_content_script_data', opts, function(data) {
      createResourceblockFilterset("build_in_filters",
            MyFilters.prototype.getExtensionFilters(data.settings));

      if (data.adblock_is_paused) {
        alert(translate("adblock_is_paused"));
        window.close();
        return;
      }
      if (!qps.itemUrl) {
        // Load all stored resources
        BGcall('resourceblock_get_frameData', qps.tabId, function(loaded_frames) {
          loaded_frames = loaded_frames || {};

          for (var thisFrame in loaded_frames) {
            var frame = loaded_frames[thisFrame];

            if (Number(thisFrame) === 0) {
              // We don't parse $document and $elemhide rules for subframes
              resources[frame.url] = {
                type: ElementTypes.document | ElementTypes.elemhide,
                domain: frame.domain,
                resource: frame.url
              };
            }

            for (var res in frame.resources) {
              if (/^HIDE\:\|\:.+/.test(res)) {
                var filter = "##" + res.substring(7);
                resources[filter] = {
                  filter: filter,
                  domain: frame.domain,
                  resource: filter
                };
              } else {
                if (/\<|\"/.test(res)) continue;
                var blockmatches = res.split(':|:');
                if (blockmatches[1].indexOf(chrome.extension.getURL("")) === 0)
                  continue; // Blacklister resources shouldn't be visible
                if (!/^[a-z\-]+\:\/\//.test(blockmatches[1]))
                  continue; // Ignore about: and data: urls
                var elemType = Number(blockmatches[0]);
                if (elemType === ElementTypes.document)
                  continue;
                resources[blockmatches[1]] = {
                  type: elemType,
                  domain: frame.domain,
                  resource: blockmatches[1]
                };
              }
            }
          }
          continue_after_another_async_call();
        });
      } else
        continue_after_another_async_call();

      function continue_after_another_async_call() {
        BGcall('get_custom_filters_text', function(filters) {
          filters = filters.split('\n');
          for (var i=0; i<filters.length; i++)
            try {
              var normalized = FilterNormalizer.normalizeLine(filters[i]);
              if (normalized) // filter out comments and ignored filters
                custom_filters[normalized] = filters[i];
            } catch(ex) {} //Broken filter
          createResourceblockFilterset("user_custom_filters", Object.keys(custom_filters));
          finally_it_has_loaded_its_stuff();
          // If opened by the context menu, this variable exists
          if (qps.itemUrl) {
            if ($("#resourceslist input").prop("disabled")) {
              // In case the resource has been whitelisted and can't be removed
              if ($(".deleterule").length === 0) {
                alert(translate('resourceiswhitelisted'));
                window.close();
                return;
              }
              $("#legend").show();
            } else
              $("#resourceslist input").click();
            $("#choosedifferentresource").remove();
          } else
            $("#legend").show();
        });
      }
    });
  });
});

// Click event for the column titles (<th>) of a table.
// It'll sort the table upon the contents of that column
sortTable = function() {
  var table = $(this).closest('table');
  if (table.find('[colspan]').length)
    return; // can't handle the case where some columns have been merged locally
  var columnNumber = $(this).prevAll().length + 1;
  if ($(this).attr("data-sortDirection") === "ascending") {
    $(this).attr("data-sortDirection", "descending"); // Z->A
  } else {
    $(this).attr("data-sortDirection", "ascending"); // A->Z
  }
  var cellList = [];
  var rowList = [];
  $("td:nth-of-type(" + columnNumber + ")", table).each(function(index, element) {
    cellList.push(element.innerHTML.toLowerCase() + 'ÿÿÿÿÿ' + (index+10000));
    rowList.push($(element).parent('tr').clone(true));
  });
  cellList.sort();
  if ($(this).attr("data-sortDirection") === "descending")
    cellList.reverse();
  $("tbody", table).empty();
  cellList.forEach(function(item) {
    var no = Number(item.match(/\d+$/)[0]) - 10000;
    $("tbody", table).append(rowList[no]);
  });
};
