// A single filter rule.
class Filter {
    constructor() {
        // Saves the last used ID for a filter
        if (!Filter._lastId) {
            Filter._lastId = 0;
        }
        // Maps filter text to Filter instances.  This is important, as it allows
        // us to throw away and rebuild the FilterSet at will.
        // Will be cleared after a fixed time interval
        if (!Filter._cache) {
            Filter._cache = {};
        }
        this.id = ++Filter._lastId;
    }

    // Return a Filter instance for the given filter text.
    // Throw an exception if the filter is invalid.
    static fromText(text) {
        var cache = Filter._cache;
        if (!cache) {
            cache = Filter._cache = {};
        }
        if (!(text in cache)) {
            if (Filter.isSelectorFilter(text)) {
                cache[text] = new SelectorFilter(text);
            } else {
                cache[text] = PatternFilter.fromText(text);
            }
        }
        return cache[text];
    }

    // Test if pattern#@#pattern or pattern##pattern
    static isSelectorFilter(text) {
        // This returns true for both hiding rules as hiding whitelist rules
        // This means that you'll first have to check if something is an excluded rule
        // before checking this, if the difference matters.
        return /\#\@?\#./.test(text);
    }

    static isSelectorExcludeFilter(text) {
        return /\#\@\#./.test(text);
    }

    static isWhitelistFilter(text) {
        return /^\@\@/.test(text);
    }

    static isComment(text) {
        return text.length === 0 ||
            text[0] === "!" ||
            (/^\[adblock/i.test(text)) ||
            (/^\(adblock/i.test(text));
    }

    // Convert a comma-separated list of domain includes and excludes
    // into a DomainSet.
    static _toDomainSet(domainText, divider) {
        var domains = domainText.split(divider);

        var data = {};
        data[DomainSet.ALL] = true;

        if (domains == "") {
            return new DomainSet(data);
        }

        for (var i = 0; i < domains.length; i++) {
            var domain = domains[i];
            if (domain[0] === "~") {
                data[domain.substring(1)] = false;
            } else {
                data[domain] = true;
                data[DomainSet.ALL] = false;
            }
        }

        return new DomainSet(data);
    }
}

// Filters that block by CSS selector.
class SelectorFilter extends Filter {
    constructor(text) {
        super();
        var parts = text.match(/(^.*?)\#\@?\#(.+$)/);
        this._domains = Filter._toDomainSet(parts[1], ",");
        this.selector = parts[2];
        if (typeof QUnit === undefined && storage_get("settings") && storage_get("settings").show_advanced_options) {
            this._text = text; // we are not rewriting text of a selector while unit-testing
        }
    }

    // If !|excludeFilters|, returns filter.
    // Otherwise, returns a new SelectorFilter that is the combination of
    // |filter| and each selector exclusion filter in the given list.
    static merge(filter, excludeFilters) {
        if (!excludeFilters) {
            return filter;
        }

        var domains = filter._domains.clone();
        for (var i = 0; i < excludeFilters.length; i++) {
            domains.subtract(excludeFilters[i]._domains);
        }

        var result = new SelectorFilter("_##_");
        result.selector = filter.selector;
        if (filter._text) {
            result._text = filter._text;
        }
        result._domains = domains;

        return result;
    }
}

// Filters that block by URL regex or substring.
// Blocking and whitelist rules both become PatternFilters.
class PatternFilter extends Filter {
    constructor() {
        super();
    }

    // Data is [rule text, allowed element types, options].
    static fromData(data) {
        var result = new PatternFilter();
        result._rule = new RegExp(data[0]);
        result._allowedElementTypes = data[1];
        result._options = data[2];
        var data = {};
        data[DomainSet.ALL] = true;
        result._domains = new DomainSet(data);
        return result;
    }

    // Text is the original filter text of a blocking or whitelist filter.
    // Throws an exception if the rule is invalid
    static fromText(text) {
        var data = PatternFilter._parseRule(text);

        var result = new PatternFilter();
        result._domains = Filter._toDomainSet(data.domainText, "|");
        result._allowedElementTypes = data.allowedElementTypes;
        result._options = data.options;
        result._rule = data.rule;
        result._key = data.key;
        if (storage_get("settings") && storage_get("settings").show_advanced_options) {
            result._text = text;
        }
        return result;
    }

    // Return a { rule, domainText, allowedElementTypes } object
    // for the given filter text.  Throws an exception if the rule is invalid.
    static _parseRule(text) {

        var result = {
            domainText: "",
            // TODO: when working on this code again, consider making options a
            // dictionary with boolean values instead of a bitset. This would
            // - make more sense, because these options are only checked individually
            // - collapse the two bitwise checks in Filter.matches into a single
            // boolean compare
            options: FilterOptions.NONE
        };

        var optionsRegex = /\$~?[\w\-]+(?:=[^,\s]+)?(?:,~?[\w\-]+(?:=[^,\s]+)?)*$/;
        var optionsText = text.match(optionsRegex);
        var allowedElementTypes;
        if (!optionsText) {
            var rule = text;
            var options = [];
        } else {
            var options = optionsText[0].substring(1).toLowerCase().split(",");
            var rule = text.replace(optionsText[0], "");
        }

        for (var i = 0; i < options.length; i++) {
            var option = options[i];

            if (/^domain\=/.test(option)) {
                result.domainText = option.substring(7);
                continue;
            }

            var inverted = (option[0] === "~");
            if (inverted) {
                option = option.substring(1);
            }

            option = option.replace(/\-/, "_");

            // See crbug.com/93542 -- object-subrequest is reported as "object",
            // so we treat them as synonyms.  TODO issue 5935: we must address
            // false positives/negatives due to this.
            if (option === "object_subrequest") {
                option = "object";
            }

            // "background" is a synonym for "image".
            if (option === "background") {
                option = "image";
            }

            if (option in ElementTypes) { // this option is a known element type
                if (inverted) {
                    if (allowedElementTypes === undefined) {
                        allowedElementTypes = ElementTypes.DEFAULTTYPES;
                    }
                    allowedElementTypes &= ~ElementTypes[option];
                } else {
                    if (allowedElementTypes === undefined) {
                        allowedElementTypes = ElementTypes.NONE;
                    }
                    allowedElementTypes |= ElementTypes[option];
                }
            }
            else if (option === "third_party") {
                result.options |=
                    (inverted ? FilterOptions.FIRSTPARTY : FilterOptions.THIRDPARTY);
            }
            else if (option === "match_case") {
                //doesn't have an inverted function
                result.options |= FilterOptions.MATCHCASE;
            }
            else if (option === "collapse") {
                // We currently do not support this option. However I've never seen any
                // reports where this was causing issues. So for now, simply skip this
                // option, without returning that the filter was invalid.
            }
            else {
                throw new Error("Unknown option '" + option + "' in filter '" + text + "'");
            }
        }
        // If no element types are mentioned, the default set is implied.
        // Otherwise, the element types are used, which can be ElementTypes.NONE
        if (allowedElementTypes === undefined) {
            result.allowedElementTypes = ElementTypes.DEFAULTTYPES;
        } else {
            result.allowedElementTypes = allowedElementTypes;
        }

        // We parse whitelist rules too, in which case we already know it's a
        // whitelist rule so can ignore the @@s.
        if (Filter.isWhitelistFilter(rule)) {
            rule = rule.substring(2);
        }

        // Convert regexy stuff.

        // First, check if the rule itself is in regex form.  If so, we're done.
        var matchcase = (result.options & FilterOptions.MATCHCASE) ? "" : "i";
        if (/^\/.+\/$/.test(rule)) {
            result.rule = rule.substr(1, rule.length - 2); // remove slashes
            result.rule = new RegExp(result.rule, matchcase);
            return result;
        }

        var key = rule.match(/[\w&=]{5,}/);
        if (key) {
            result.key = new RegExp(key, matchcase);
        }

        // ***** -> *
        //replace, excessive wildcard sequences with a single one
        rule = rule.replace(/\*-\*-\*-\*-\*/g, "*");

        rule = rule.replace(/\*\*+/g, "*");

        // Some chars in regexes mean something special; escape it always.
        // Escaped characters are also faster.
        // - Do not escape a-z A-Z 0-9 and _ because they can't be escaped
        // - Do not escape | ^ and * because they are handled below.
        rule = rule.replace(/([^a-zA-Z0-9_\|\^\*])/g, "\\$1");
        //^ is a separator char in ABP
        rule = rule.replace(/\^/g, "[^\\-\\.\\%a-zA-Z0-9_]");
        //If a rule contains *, replace that by .*
        rule = rule.replace(/\*/g, ".*");
        // Starting with || means it should start at a domain or subdomain name, so
        // match ://<the rule> or ://some.domains.here.and.then.<the rule>
        rule = rule.replace(/^\|\|/, "^[^\\/]+\\:\\/\\/([^\\/]+\\.)?");
        // Starting with | means it should be at the beginning of the URL.
        rule = rule.replace(/^\|/, "^");
        // Rules ending in | means the URL should end there
        rule = rule.replace(/\|$/, "$");
        // Any other '|' within a string should really be a pipe.
        rule = rule.replace(/\|/g, "\\|");
        // If it starts or ends with *, strip that -- it's a no-op.
        rule = rule.replace(/^\.\*/, "");
        rule = rule.replace(/\.\*$/, "");

        result.rule = new RegExp(rule, matchcase);
        return result;
    }

    // Returns true if an element of the given type loaded from the given URL
    // would be matched by this filter.
    //   url:string the url the element is loading.
    //   elementType:ElementTypes the type of DOM element.
    //   isThirdParty: true if the request for url was from a page of a
    //       different origin
    matches(url, elementType, isThirdParty) {
        if (!(elementType & this._allowedElementTypes)) {
            return false;
        }

        // If the resource is being loaded from the same origin as the document,
        // and your rule applies to third-party loads only, we don't care what
        // regex your rule contains, even if it's for someotherserver.com.
        if ((this._options & FilterOptions.THIRDPARTY) && !isThirdParty) {
            return false;
        }

        if ((this._options & FilterOptions.FIRSTPARTY) && isThirdParty) {
            return false;
        }

        if (this._key && !this._key.test(url)) {
            return false;
        }

        return this._rule.test(url);
    }
}