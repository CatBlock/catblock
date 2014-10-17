// Converts non-standard filters to a standard format, and removes
// invalid filters.
var FilterNormalizer = {

  // Normalize a set of filters.
  // Remove broken filters, useless comments and unsupported things.
  // Input: text:string filter strings separated by '\n'
  //        keepComments:boolean if true, comments will not be removed
  // Returns: filter strings separated by '\n' with invalid filters
  //          removed or modified
  normalizeList: function(text, keepComments) {
    var lines = text.split('\n');
    delete text;
    var result = [];
    var ignoredFilterCount = 0;
    for (var i=0; i<lines.length; i++) {
      try {
        var newfilter = FilterNormalizer.normalizeLine(lines[i]);
        if (newfilter)
          result.push(newfilter);
        else if (newfilter !== false)
          ignoredFilterCount++;
        else if (keepComments)
          result.push(lines[i]);
      } catch (ex) {
        log("Filter '" + lines[i] + "' could not be parsed: " + ex);
        ignoredFilterCount++;
      }
    }
    if (ignoredFilterCount)
      log('Ignoring ' + ignoredFilterCount + ' rule(s)');
    return result.join('\n') + '\n';
  },

  // Normalize a single filter.
  // Input: filter:string a single filter
  // Return: normalized filter string if the filter is valid, null if the filter
  //         will be ignored or false if it isn't supposed to be a filter.
  // Throws: exception if filter could not be parsed.
  //
  // Note that 'Expires' comments are considered valid comments that
  // need retention, because they carry information.
  normalizeLine: function(filter) {
    // Some rules are separated by \r\n; and hey, some rules may
    // have leading or trailing whitespace for some reason.
    filter = filter.replace(/\r$/, '').trim();

    // Remove comment/empty filters.
    if (Filter.isComment(filter))
        return false;

    // Convert old-style hiding rules to new-style.
    if (/#[\*a-z0-9_\-]*(\(|$)/.test(filter) && !/##/.test(filter)) {
      // Throws exception if unparseable.
      var oldFilter = filter;
      filter = FilterNormalizer._old_style_hiding_to_new(filter);
      log('Converted ' + oldFilter + ' to ' + filter);
    }

    // If it is a hiding rule...
    if (Filter.isSelectorFilter(filter)) {
      // The filter must be of a correct syntax

      try {
        // Throws if the filter is invalid...
        var selectorPart = filter.substr(filter.indexOf("##") + 2);
        if (document.querySelector(selectorPart + ',html').length === 0)
          throw "Causes other filters to fail";
      } catch(ex) {
        // ...however, the thing it throws is not human-readable. This is.
        throw "Invalid CSS selector syntax";
      }

      // On a few sites, we have to ignore [style] rules.
      // Affects Chrome (crbug 68705) and Safari (issue 6225).
      if (/style([\^\$\*]?=|\])/.test(filter)) {
        var ignoreStyleRulesOnTheseSites = "~mail.google.com,~mail.yahoo.com";
        if (filter.indexOf(ignoreStyleRulesOnTheseSites) == -1) {
          if (filter[0] != "#") ignoreStyleRulesOnTheseSites += ",";
          filter = ignoreStyleRulesOnTheseSites + filter;
        }
      }

      // This was a filter which only worked in older Gecko browsers (FF3)
      // They'll never match in WebKit browsers.
      if (/\~pregecko2.*\#\#/.test(filter))
        return null;

      var parsedFilter = new SelectorFilter(filter);

    } else { // If it is a blocking rule...
      var parsedFilter = PatternFilter.fromText(filter); // throws if invalid
      var types = parsedFilter._allowedElementTypes;

      var whitelistOptions = (ElementTypes.document | ElementTypes.elemhide);
      var hasWhitelistOptions = types & whitelistOptions;
      if (!Filter.isWhitelistFilter(filter) && hasWhitelistOptions)
        throw "$document and $elemhide may only be used on whitelist filters";

      // In Safari, ignore rules with only Chrome-specific types (no-ops).
      if (SAFARI && types === (types & ElementTypes.CHROMEONLY))
        return null;
    }

    // Ignore filters whose domains aren't formatted properly.
    FilterNormalizer._verifyDomains(parsedFilter._domains);

    // Nothing's wrong with the filter.
    return filter;
  },

  // Convert an old-style hiding rule to a new one.
  // Input: filter:string old-style filter
  // Returns: string new-style filter
  // Throws: exception if filter is unparseable.
  _old_style_hiding_to_new: function(filter) {
    // Old-style is domain#node(attr=value) or domain#node(attr)
    // domain and node are optional, and there can be many () parts.
    filter = filter.replace('#', '##');
    var parts = filter.split('##'); // -> [domain, rule]
    var domain = parts[0];
    var rule = parts[1];

    // Make sure the rule has only the following two things:
    // 1. a node -- this is optional and must be '*' or alphanumeric
    // 2. a series of ()-delimited arbitrary strings -- also optional
    //    the ()s can't be empty, and can't start with '='
    if (rule.length == 0 ||
        !/^(?:\*|[a-z0-9\-_]*)(?:\([^=][^\)]*?\))*$/i.test(rule))
      throw "bad selector filter";

    var first_segment = rule.indexOf('(');

    if (first_segment == -1)
      return domain + '##' + rule;

    var node = rule.substring(0, first_segment);
    var segments = rule.substring(first_segment);

    // turn all (foo) groups into [foo]
    segments = segments.replace(/\((.*?)\)/g, "[$1]");
    // turn all [foo=bar baz] groups into [foo="bar baz"]
    // Specifically match:    = then not " then anything till ]
    segments = segments.replace(/\=([^"][^\]]*)/g, '="$1"');
    // turn all [foo] into .foo, #foo
    // #div(adblock) means all divs with class or id adblock
    // class must be a single class, not multiple (not #*(ad listitem))
    // I haven't ever seen filters like #div(foo)(anotherfoo), so ignore these
    var resultFilter = node + segments;
    var match = resultFilter.match(/\[([^\=]*?)\]/);
    if (match)
      resultFilter = resultFilter.replace(match[0], "#" + match[1]) +
       "," + resultFilter.replace(match[0], "." + match[1]);

    return domain + "##" + resultFilter;
  },

  // Throw an exception if the input contains invalid domains.
  // Input: domainInfo: { applied_on:array, not_applied_on:array }, where each
  //                    array entry is a domain.
  _verifyDomains: function(domainInfo) {
    for (var name in { "applied_on":1, "not_applied_on":1 }) {
      for (var i = 0; i < domainInfo[name].length; i++) {
        if (/^([a-z0-9\-_\u00DF-\u00F6\u00F8-\uFFFFFF]+\.)*[a-z0-9\u00DF-\u00F6\u00F8-\uFFFFFF]+$/i.test(domainInfo[name][i]) == false)
          throw "Invalid domain: " + domainInfo[name][i];
      }
    }
  }
}
