var DeclarativeWebRequest = (function() {
    if (!safari ||
        !safari.extension ||
        (typeof safari.extension.setContentBlocker !== "function")) {
        return;
    }
    const HTML_PREFIX = "^https?://.*";
    const PAGELEVEL_TYPES = (ElementTypes.elemhide | ElementTypes.document);
    const UNSUPPORTED_TYPES = (ElementTypes.subdocument | ElementTypes.object | ElementTypes.object_subrequest);
    var whitelistAnyOtherFilters = [];
    var elementWhitelistFilters = [];
    var documentWhitelistFilters = [];
    var elemhideSelectorExceptions = {};

    // Returns true if |filter| is of type $document or $elemhide
    function isPageLevel(filter) {
        return filter._allowedElementTypes & PAGELEVEL_TYPES;
    }

    // Returns false if the given filter cannot be handled by Safari 9 content blocking.
    function isSupported(filter) {
        if (!filter.hasOwnProperty("_allowedElementTypes")) {
            return true;
        }
        return !(filter._allowedElementTypes === (filter._allowedElementTypes & UNSUPPORTED_TYPES));
    }

    // Remove any characters from the filter lists that are not needed, such as |##| and |.|
    function parseSelector(selector) {
        if (selector.indexOf("##") === 0) {
            selector = selector.substring(2, selector.length);
        }
        return selector;
    }

    // Returns an object containing .included and .excluded lists of domains for
    // the given Filter.  If the Filter is of the form $domain=~x[,~x2,...] then
    // add |undefined| to the .included list to represent the implied global
    // domain matched by the filter.
    function getDomains(filter) {
        var result = {
            included: [],
            excluded: []
        };
        if (isPageLevel(filter)) {
            result.included.push(undefined);
            return result;
        }
        var has = filter._domains.has;
        if (has[DomainSet.ALL]) {
            result.included.push(undefined);
        }
        for (var d in has) {
            if (has.hasOwnProperty(d)) {
                if (d === DomainSet.ALL) {
                    continue;
                }
                var parsedDomain = punycode.toASCII(d).toLowerCase();
                // Remove the leading 'www'
                if (parsedDomain.indexOf("www.") === 0) {
                    parsedDomain = parsedDomain.substr(4);
                }
                if (has[d]) {
                    result.included.push("*" + parsedDomain);
                } else {
                    result.excluded.push(parsedDomain);
                }
            }
        }
        return result;
    }

    // Add the include / exclude domains to a rule
    // Note:  some filters will have both include and exclude domains, which the content blocking API doesn't allow,
    //        so we only add the exclude domains when there isn't any include domains.
    function addDomainsToRule(filter, rule) {
        var domains = getDomains(filter);
        //since the global / ALL domain is included in the 'included' array, check for something other than undefined in the zero element
        if (domains.included.length > 0 && domains.included[0] !== undefined) {
            rule.trigger["if-domain"] = domains.included;
        } else if (domains.excluded.length > 0) {
            rule.trigger["unless-domain"] = domains.excluded;
        }
    }

    // Returns an array of resource types that should be checked by rules for
    // filters with the given allowedElementTypes.
    function getResourceTypesByElementType(elementTypes) {
        var result = [];
        if (elementTypes & ElementTypes.image) {
            result.push("image");
        }
        if (elementTypes & ElementTypes.stylesheet) {
            result.push("style-sheet");
        }
        if (elementTypes & ElementTypes.script) {
            result.push("script");
        }
        if (elementTypes & (ElementTypes.media | ElementTypes.object)) {
            result.push("media");
        }
        if (elementTypes & ElementTypes.popup) {
            result.push("popup");
        }
        if (elementTypes & (ElementTypes.xmlhttprequest | ElementTypes.other | ElementTypes.object_subrequest)) {
            result.push("raw");
        }
        if (elementTypes & ElementTypes.subdocument) {
            result.push("document");
        }
        return result;
    }

    // Parse and clean up the filter's RegEx to meet WebKit's requirements.
    function getURLFilterFromFilter(filter) {
        //remove any whitespace
        var rule = filter._rule.source;
        rule = rule.trim();
        if (rule.endsWith("/i")) {
            var regexSwitchPos = rule.lastIndexOf("/i");
            rule = rule.substring(0, regexSwitchPos);
        }
        // make sure to limit rules to to HTTP(S) URLs (if not already limited)
        if (!/^(\^|http|\/http)/.test(rule)) {
            rule = HTML_PREFIX + rule;
        }
        return rule;
    }

    // Separates the different white list filters so they are added
    // to the final rule array in the correct order (for performance reasons)
    function preProcessWhitelistFilters(whitelistFilters) {
        for (var inx = 0; inx < whitelistFilters.length; inx++) {
            var filter = whitelistFilters[inx];
            if (isSupported(filter) &&
                (filter._allowedElementTypes &
                 (ElementTypes.script |
                  ElementTypes.image |
                  ElementTypes.stylesheet |
                  ElementTypes.object |
                  ElementTypes.subdocument |
                  ElementTypes.object_subrequest |
                  ElementTypes.media |
                  ElementTypes.other |
                  ElementTypes.xmlhttprequest))) {
                whitelistAnyOtherFilters.push(filter);
            }
            if (isSupported(filter) && (filter._allowedElementTypes & ElementTypes.elemhide)) {
                elementWhitelistFilters.push(filter);
            }
            if (isSupported(filter) && (filter._allowedElementTypes & ElementTypes.document)) {
                documentWhitelistFilters.push(filter);
            }
        }
    }

    // Create and return a default JavaScript rule object
    function createDefaultRule() {
        var rule = {};
        rule.action = {};
        rule.action.type = "block";
        rule.trigger = {};
        rule.trigger["url-filter"] = HTML_PREFIX;
        return rule;
    }

    // Return the rule required to represent this PatternFilter in Safari blocking syntax.
    function getRule(filter) {
        var rule = createDefaultRule();
        rule.trigger["url-filter"] = getURLFilterFromFilter(filter);
        var resourceArray = getResourceTypesByElementType(filter._allowedElementTypes);
        if (resourceArray && resourceArray.length > 0) {
            rule.trigger["resource-type"] = resourceArray;
        }
        addDomainsToRule(filter, rule);
        if (filter._options & FilterOptions.THIRDPARTY) {
            rule.trigger["load-type"] = ["third-party"];
        } else {
            rule.trigger["load-type"] = ["first-party"];
        }
        return rule;
    }

    // Return the rule (JSON) required to represent this Selector Filter in Safari blocking syntax.
    function createSelectorRule(filter) {
        var rule = createDefaultRule();
        rule.action.selector = parseSelector(filter.selector);
        rule.action.type = "css-display-none";
        addDomainsToRule(filter, rule);
        return rule;
    }

    // Return the rule (JSON) required to represent this $elemhide Whitelist Filter in Safari blocking syntax.
    function createElemhideIgnoreRule(filter) {
        var rule = createDefaultRule();
        rule.action.type = "ignore-previous-rules";
        rule.trigger["url-filter"] = getURLFilterFromFilter(filter);
        var resourceArray = getResourceTypesByElementType(filter._allowedElementTypes);
        if (resourceArray && resourceArray.length > 0) {
            rule.trigger["resource-type"] = resourceArray;
        }
        if (filter._options & FilterOptions.THIRDPARTY) {
            rule.trigger["load-type"] = ["third-party"];
        } else {
            rule.trigger["load-type"] = ["first-party"];
        }
        addDomainsToRule(filter, rule);
        return rule;
    }

    // Return the rule (JSON) required to represent this Selector Filter in Safari blocking syntax.
    function createEmptySelectorRule() {
        var rule = createDefaultRule();
        rule.action.type = "css-display-none";
        return rule;
    }

    // Return the rule (JSON) required to represent this $document Whitelist Filter in Safari blocking syntax.
    function createDocumentIgnoreRule(filter) {
        var rule = createDefaultRule();
        rule.action = {"type": "ignore-previous-rules"};
        rule.trigger["url-filter"] = getURLFilterFromFilter(filter);
        var resourceArray = getResourceTypesByElementType(filter._allowedElementTypes);
        if (resourceArray && resourceArray.length > 0) {
            rule.trigger["resource-type"] = resourceArray;
        }
        addDomainsToRule(filter, rule);
        return rule;
    }

    // Return the rule (JSON) required to represent this Whitelist Filter in Safari blocking syntax.
    function createIgnoreRule(filter) {
        var rule = createDefaultRule();
        rule.action = {"type": "ignore-previous-rules"};
        rule.trigger["url-filter"] = getURLFilterFromFilter(filter);
        var resourceArray = getResourceTypesByElementType(filter._allowedElementTypes);
        if (resourceArray && resourceArray.length > 0) {
            rule.trigger["resource-type"] = resourceArray;
        }
        addDomainsToRule(filter, rule);
        return rule;
    }

    function resetInternalArrays() {
        whitelistAnyOtherFilters = [];
        elementWhitelistFilters = [];
        documentWhitelistFilters = [];
        elemhideSelectorExceptions = {};
    }

    return {
        // Converts the various Filters into Safari specific JSON entries.
        // Returns an array of the JSON rules
        convertFilterLists: function(patternFilters, whitelistFilters, selectorFilters, selectorFiltersAll) {
            resetInternalArrays();
            preProcessWhitelistFilters(whitelistFilters);

            function hasUpperCase(str) {
                return str.toLowerCase() !== str;
            }
            var rules = [];
            //step 1a, add all of the generic hiding filters (CSS selectors)
            //step 1a, add all of the generic hiding filters (CSS selectors)
            const GROUPSIZE = 1000;
            for (var i = 0; i < selectorFiltersAll.length; i += GROUPSIZE) {
                var start = i;
                var end = Math.min((i + GROUPSIZE), selectorFiltersAll.length);
                var selectorText = "";
                for (var j = start; j < end; j++) {
                    var filter = selectorFiltersAll[j];
                    if (isSupported(filter)) {
                        // If the selector is an ID selector and contains an upper case character
                        // also add an all lower case version due to a webkit bug (#23616574)
                        var tempSelector = parseSelector(filter.selector);
                        if ((tempSelector.charAt(0) === "#") &&
                            hasUpperCase(tempSelector)) {
                            tempSelector = tempSelector + ", " + tempSelector.toLowerCase();
                        }
                        if (selectorText === "") {
                            selectorText = tempSelector;
                        } else {
                            selectorText = selectorText + ", " + tempSelector;
                        }
                    }
                }

                var theRule = createEmptySelectorRule();
                theRule.action.selector = selectorText;
                rules.push(theRule);
            }

            //step 1b, add all of the domain inclusive / exclusive hiding filters (CSS selectors)
            selectorFilters.forEach(function(filter) {
                if (isSupported(filter)) {
                    rules.push(createSelectorRule(filter));
                }
            });
            //step 2, now add only the $elemhide filters
            elementWhitelistFilters.forEach(function(filter) {
                var rule = createElemhideIgnoreRule(filter);
                rules.push(rule);
            });
            //step 3, now add the blocking rules
            patternFilters.forEach(function(filter) {
                if (isSupported(filter)) {

                    var rule = getRule(filter);
                    var is_valid = true;
                    try {
                        new RegExp(rule.trigger["url-filter"]);
                    } catch(ex) {
                        is_valid = false;
                    }
                    if (is_valid) {
                        rules.push(rule);
                    }
                }
            });

            //step 4, add all $document
            documentWhitelistFilters.forEach(function(filter) {
                var rule = createDocumentIgnoreRule(filter);
                rules.push(rule);
            });
            //step 5, add other whitelist rules
            whitelistAnyOtherFilters.forEach(function(filter) {
                var rule = createIgnoreRule(filter);
                rules.push(rule);
            });
            return rules;
        },
        // Converts an array of Malware domains into blocking rules
        // Returns an array of the JSON rules
        convertMalware: function(malwareDomains) {
            // Add malware domains into blocking rules
            var rules = [];
            if (malwareDomains && malwareDomains.length > 0) {
                const GROUPSIZE = 1000;
                for (var i = 0; i < malwareDomains.length; i += GROUPSIZE) {
                    var start = i;
                    var end = Math.min((i + GROUPSIZE), malwareDomains.length);
                    var rule = createDefaultRule();
                    var unparsedDomainArray = malwareDomains.slice(start, end);
                    var parsedDomainArray = [];
                    for (var j = 0; j < unparsedDomainArray.length; j++) {
                        parsedDomainArray.push(punycode.toASCII(unparsedDomainArray[j]).toLowerCase());
                    }
                    rule.trigger["if-domain"] = parsedDomainArray;
                    rules.push(rule);
                }
            }
            return rules;
        }
    };
})();
