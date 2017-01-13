// Variables "failure" and "messages" are exported via BrowserStack to our Python "make_release.py" script,
// which handles building of our extension via Travis-CI.

// Messages contains summary of failed (if any) test cases
var messages = "";

// Failure is true, when one or more test cases have failed
var failure = false;

// Settings contains enabled and disabled user settings
// This fixes access to the settings while running test cases, e.g. "get_settings is not defined" - myfilters.js:434
var settings = null;

function get_settings() {
    return settings;
};

// QUnit module intended for tracking and exporting tests failures to the "messages" variable
(function() {
    var module = "",
        test = "",
        lastModuleLogged = "",
        lastTestLogged = "",
        failuresOnCurrentTest = 0,
        failureFound = false;

    function log(arg) {
        messages = messages + arg + "\n";
    }

    QUnit.moduleStart(function(details) {
        module = details.name;
    });

    QUnit.testStart(function(details) {
        test = details.name;
    });

    QUnit.log(function(details) {
        if (!details.result) {
            if (!failureFound) {
                failureFound = true;
                failure = true;
                log("");
                log("/*********************************************************************/");
                log("/************************** FAILURE SUMMARY **************************/");
                log("/*********************************************************************/");
            }

            if (lastModuleLogged != module) {
                log("");
                log("-----------------------------------------------------------------------");
                log("Module: " + module);
            }

            if (lastTestLogged != test) {
                failuresOnCurrentTest = 1;
                log("-----------------------------------------------------------------------");
                log("Test: " + test);
            } else {
                failuresOnCurrentTest++;
            }

            log(" " + failuresOnCurrentTest + ") Message: " + details.message);
            if (typeof details.expected !== "undefined") {
                log("    Expected: " + details.expected);
                log("    Actual: " + details.actual);
            }
            if (typeof details.source !== "undefined") {
                log("    Source: " + details.source);
            }

            lastModuleLogged = module;
            lastTestLogged = test;
        }
    });
}());

BGcall("get_settings", function(data) {
    settings = data;
    QUnit.module("General");
    QUnit.test("Using extension domain", function(assert) {
        assert.expect(1);
        assert.ok(window.chrome && chrome.extension, "This test suite should be running on an extension URL");
    });

    QUnit.module("Parsing URLs: parseURI");
    QUnit.test("parseURI", function(assert) {
        var searchParams = new URL("https://foo.bar/").searchParams;
        assert.expect(17);
        assert.deepEqual(new parseURI("https://foo.bar/"), {"hash": "", "host": "foo.bar", "hostname": "foo.bar", "href": "https://foo.bar/", "origin": "https://foo.bar", "pathname": "/", "password": "", "port": "", "protocol": "https:", "search": "", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("https://foo.bar:80/"), {"hash": "", "host": "foo.bar:80", "hostname": "foo.bar", "href": "https://foo.bar:80/", "origin": "https://foo.bar:80", "password": "", "pathname": "/", "port": "80", "protocol": "https:", "search": "", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("https://foo.bar/?http://www.google.nl/search?"), {"hash": "", "host": "foo.bar", "hostname": "foo.bar", "href": "https://foo.bar/?http://www.google.nl/search?", "origin": "https://foo.bar", "password": "", "pathname": "/", "port": "", "protocol": "https:", "search": "?http://www.google.nl/search?", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("https:foo.bar/?http://www.google.nl/search?"), {"hash": "", "host": "foo.bar", "hostname": "foo.bar", "href": "https://foo.bar/?http://www.google.nl/search?", "origin": "https://foo.bar", "password": "", "pathname": "/", "port": "", "protocol": "https:", "search": "?http://www.google.nl/search?", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("http://usr:@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"), {"hash": "#top", "host": "www.test.com:81", "hostname": "www.test.com", "href": "http://usr@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top", "origin": "http://www.test.com:81", "password": "", "pathname": "/dir/dir.2/index.htm", "port": "81", "protocol": "http:", "search": "?q1=0&&test1&test2=value", "searchParams": searchParams, "username": "usr"});
        assert.deepEqual(new parseURI("http://usr:pass@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"), {"hash": "#top", "host": "www.test.com:81", "hostname": "www.test.com", "href": "http://usr:pass@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top", "origin": "http://www.test.com:81", "password": "pass", "pathname": "/dir/dir.2/index.htm", "port": "81", "protocol": "http:", "search": "?q1=0&&test1&test2=value", "searchParams": searchParams, "username": "usr"});
        assert.deepEqual(new parseURI("http://usr:pass@www.test.com/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"), {"hash": "#top", "host": "www.test.com", "hostname": "www.test.com", "href": "http://usr:pass@www.test.com/dir/dir.2/index.htm?q1=0&&test1&test2=value#top", "origin": "http://www.test.com", "password": "pass", "pathname": "/dir/dir.2/index.htm", "port": "", "protocol": "http:", "search": "?q1=0&&test1&test2=value", "searchParams": searchParams, "username": "usr"});
        assert.deepEqual(new parseURI("http://www.test.com/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"), {"hash": "#top", "host": "www.test.com", "hostname": "www.test.com", "href": "http://www.test.com/dir/dir.2/index.htm?q1=0&&test1&test2=value#top", "origin": "http://www.test.com", "password": "", "pathname": "/dir/dir.2/index.htm", "port": "", "protocol": "http:", "search": "?q1=0&&test1&test2=value", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("http://www.test.com/dir/dir@2/index.htm#top"), {"hash": "#top", "host": "www.test.com", "hostname": "www.test.com", "href": "http://www.test.com/dir/dir@2/index.htm#top", "origin": "http://www.test.com", "password": "", "pathname": "/dir/dir@2/index.htm", "port": "", "protocol": "http:", "search": "", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("http://www.test.com/dir/dir@2/index#top"), {"hash": "#top", "host": "www.test.com", "hostname": "www.test.com", "href": "http://www.test.com/dir/dir@2/index#top", "origin": "http://www.test.com", "password": "", "pathname": "/dir/dir@2/index", "port": "", "protocol": "http:", "search": "", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("http://test.com/dir/dir@2/#top"), {"hash": "#top", "host": "test.com", "hostname": "test.com", "href": "http://test.com/dir/dir@2/#top", "origin": "http://test.com", "password": "", "pathname": "/dir/dir@2/", "port": "", "protocol": "http:", "search": "", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("http://www.test.com/dir/dir@2/?top"), {"hash": "", "host": "www.test.com", "hostname": "www.test.com", "href": "http://www.test.com/dir/dir@2/?top", "origin": "http://www.test.com", "password": "", "pathname": "/dir/dir@2/", "port": "", "protocol": "http:", "search": "?top", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("http://www.test.com/dir/dir@2/"), {"hash": "", "host": "www.test.com", "hostname": "www.test.com", "href": "http://www.test.com/dir/dir@2/", "origin": "http://www.test.com", "password": "", "pathname": "/dir/dir@2/", "port": "", "protocol": "http:", "search": "", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("feed:https://www.test.com/dir/dir@2/"), {"hash": "", "host": "", "hostname": "", "href": "feed:https://www.test.com/dir/dir@2/", "origin": "feed://", "password": "", "pathname": "https://www.test.com/dir/dir@2/", "port": "", "protocol": "feed:", "search": "", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("feed:https://www.test.com:80/dir/dir@2/"), {"hash": "", "host": "", "hostname": "", "href": "feed:https://www.test.com:80/dir/dir@2/", "origin": "feed://", "password": "", "pathname": "https://www.test.com:80/dir/dir@2/", "port": "", "protocol": "feed:", "search": "", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("feed:https://www.test.com/dir/dir2/?http://foo.bar/"), {"hash": "", "host": "", "hostname": "", "href": "feed:https://www.test.com/dir/dir2/?http://foo.bar/", "origin": "feed://", "password": "", "pathname": "https://www.test.com/dir/dir2/", "port": "", "protocol": "feed:", "search": "?http://foo.bar/", "searchParams": searchParams, "username": ""});
        assert.deepEqual(new parseURI("chrome-extension://longidentifier/tools/tests/index.html?notrycatch=true"), {"hash": "", "host": "longidentifier", "hostname": "longidentifier", "href": "chrome-extension://longidentifier/tools/tests/index.html?notrycatch=true", "origin": "chrome-extension://longidentifier", "password": "", "pathname": "/tools/tests/index.html", "port": "", "protocol": "chrome-extension:", "search": "?notrycatch=true", "searchParams": searchParams, "username": ""});
    });

    QUnit.test("parseSearch", function(assert) {
        assert.expect(11);
        assert.deepEqual(parseURI.parseSearch("?hello=world&ext=adblock&time=bedtime"), {"ext": "adblock", "hello": "world", "time": "bedtime"});
        assert.deepEqual(parseURI.parseSearch(""), {});
        assert.deepEqual(parseURI.parseSearch("?"), {});
        assert.deepEqual(parseURI.parseSearch("?hello"), {"hello": ""});
        assert.deepEqual(parseURI.parseSearch("?hello=world"), {"hello": "world"});
        assert.deepEqual(parseURI.parseSearch("?hello&ext=adblock"), {"ext": "adblock", "hello": ""});
        assert.deepEqual(parseURI.parseSearch("?ext=adblock&hello"), {"ext": "adblock", "hello": ""});
        assert.deepEqual(parseURI.parseSearch("?hello=world&hello=earth"), {"hello": "earth"});
        assert.deepEqual(parseURI.parseSearch("?hello=&ext=adblock"), {"ext": "adblock", "hello": ""});
        assert.deepEqual(parseURI.parseSearch("?hello=world&&ext=adblock"), {"ext": "adblock", "hello": "world"});
        assert.deepEqual(parseURI.parseSearch("?hello&&&&ext=adblock"), {"ext": "adblock", "hello": ""});
    });

    QUnit.test("parseSecondLevelDomain", function(assert) {
        assert.expect(5);
        var secondLevelDomainOnly = parseURI.secondLevelDomainOnly;
        assert.deepEqual(secondLevelDomainOnly("appspot.google.com"), "google.com");
        assert.deepEqual(secondLevelDomainOnly("foo.bar.com"), "bar.com");
        assert.deepEqual(secondLevelDomainOnly("https://www.google.com.ph"), "com.ph");
        assert.deepEqual(secondLevelDomainOnly("http://usr:pass@www.test.com:81/dir"), "test.com:81/dir");
        assert.deepEqual(secondLevelDomainOnly("http://support.godaddy.com"), "godaddy.com");
    });

    QUnit.module("Parsing URLs: ");
    QUnit.test("IDN conversions", function(assert) {
        assert.expect(10);
        assert.equal(new parseURI("https://google.com").href, 'https://google.com/');
        assert.equal(new parseURI('https://www.xn--maana-pta.com').href, 'https://www.mañana.com/');
        assert.equal(new parseURI('https://www.xn--bcher-kva.com').href, "https://www.bücher.com/");
        assert.equal(new parseURI('https://www.xn--bcher-kva.com').href, 'https://www.b\xFCcher.com/');
        assert.equal(new parseURI('https://www.xn----dqo34k.com').href, "https://www.☃-⌘.com/");
        assert.equal(new parseURI('https://www.xn--ls8h.la').href, "https://www.💩.la/");
        assert.equal(new parseURI('http://www.xn--maana-pta.com').href, "http://www.mañana.com/");
        assert.equal(new parseURI('http://www.xn----dqo34k.com').href, "http://www.☃-⌘.com/");
        assert.equal(new parseURI('http://www.xn----dqo34k.com/foo/blah?t=is#here').href, "http://www.☃-⌘.com/foo/blah?t=is#here");
        assert.equal(new parseURI('http://www.google.com/foo/blah?t=is#here').href, 'http://www.google.com/foo/blah?t=is#here');
    });

    QUnit.module("Global Functions");
    QUnit.test("storage get and storage set", function(assert) {
        var testObj = {
            foo: "bar",
            bar: "foo",
        };
        // the following will allow the the storage functions.js to execute correctly
        // tests failling because the Safari extension API safari.extension.settings is only
        // available to the 'global' page.  We'll set it correctly here.
        if (/Safari/.test(navigator.userAgent) &&
            !/Chrome/.test(navigator.userAgent)) {
            safari.extension.settings = localStorage;
        }
        storage_set("testObj", testObj);
        var testResultObj = storage_get("testObj");
        assert.deepEqual(testObj.foo, testResultObj.foo);
        assert.deepEqual(testObj.bar, testResultObj.bar);
        assert.deepEqual(testObj, testResultObj);

        assert.notEqual(testObj, testResultObj);

        storage_set("foo", testObj.foo);
        var foo = storage_get("foo");
        assert.deepEqual(testObj.foo, foo);
        assert.strictEqual(testObj.foo, foo);
        assert.equal(testObj.foo, foo);

        storage_set("foo", "not foo");
        foo = storage_get("foo");
        assert.notDeepEqual(testObj.foo, foo);
        assert.notStrictEqual(testObj.foo, foo);
        assert.notEqual(testObj.foo, foo);

        testObj.foo = "not foo";
        testObj.bar = "not bar";
        testResultObj = storage_get("testObj");
        assert.notDeepEqual(testObj.foo, testResultObj.foo);
        assert.notDeepEqual(testObj.bar, testResultObj.bar);
        assert.notDeepEqual(testObj, testResultObj);
    });

    QUnit.test("setDefault", function(assert) {
        var testObj = {
            foo: "bar",
            bar: "foo",
        };

        var testMap = {
            first: "one",
            second: "two",
            third: "three",
        };

        var first = setDefault(testMap, "first", "noOne");

        assert.strictEqual(testMap.first, first);
        assert.notStrictEqual(testMap.first, "noOne");

        first = setDefault(testMap, "notHere", testObj);

        assert.deepEqual(testMap.notHere, testObj);
        assert.deepEqual(first, testObj);
        assert.deepEqual(first, testMap.notHere);
        assert.ok(testMap.notHere == testObj && testMap.notHere== first, "should be the same object");

        testObj = {
            bar: "foo",
        }

        first = setDefault(testMap, "notHere", testObj);
        assert.notDeepEqual(testMap.notHere, testObj);
        assert.notDeepEqual(first, testObj);
        assert.ok(testMap.notHere != testObj && first != testObj, "should not be the same");
    });

    QUnit.module("FilterTypes");
    QUnit.test("selector filter", function(assert) {
        var isSelectorFilter = Filter.isSelectorFilter;
        assert.ok(isSelectorFilter("www.foo.com##IMG[src='http://randomimg.com']"), "Is a selector filter");
        assert.ok(isSelectorFilter("www.foo.com#@#IMG[src='http://randomimg.com']"), "Is an exclude selector filter");
        assert.ok(!isSelectorFilter("www.foo.com#@IMG[src='http://randomimg.com']"), "Is not a selector filter");
    });

    QUnit.test("exclude selector filter", function(assert) {
        var isSelectorExcludeFilter = Filter.isSelectorExcludeFilter;
        assert.ok(!isSelectorExcludeFilter("www.foo.com##IMG[src='http://randomimg.com']"), "Is not an exclude selector filter");
        assert.ok(isSelectorExcludeFilter("www.foo.com#@#IMG[src='http://randomimg.com']"), "Is an exclude selector filter");
        assert.ok(!isSelectorExcludeFilter("www.foo.com#@IMG[src='http://randomimg.com']"), "Is not an exclude selector filter");
    });

    QUnit.test("whitelist filter", function(assert) {
        var isWhitelistFilter = Filter.isWhitelistFilter;
        assert.ok(!isWhitelistFilter("www.foo.com@@IMG[src='http://randomimg.com']"), "Is not a whitelist filter");
        assert.ok(isWhitelistFilter("@@IMG[src='http://randomimg.com']"), "Is a whitelist filter");
    });

    QUnit.test("comment", function(assert) {
        var isComment = Filter.isComment;
        assert.ok(isComment("! foo comment"), "comment that starts with '!'");
        assert.ok(isComment("[adblock foo comment"), "comment that starts with '[adblock'");
        assert.ok(isComment("(adblock foo comment"), "comment that starts with '(adblock'");

        assert.ok(!isComment(" ! foo comment"), "comment that does not start with '!'");
        assert.ok(!isComment(" [ adblock foo comment"), "comment that does not start with '[adblock'");
        assert.ok(!isComment(" ( adblock foo comment"), "comment that does not start with '(adblock'");
    });

    QUnit.test("create selector filter from text", function(assert) {
        var fromText = Filter.fromText;
        assert.ok(fromText("www.foo.com##IMG[src='http://randomimg.com']") instanceof SelectorFilter, "is a SelectorFilter object");
        assert.ok(fromText("www.foo.com#@#IMG[src='http://randomimg.com']") instanceof SelectorFilter, "is a SelectorFilter object");
        assert.ok(!(fromText("www.foo.com#@IMG[src='http://randomimg.com']") instanceof SelectorFilter), "is not a SelectorFilter object");

        // Test selector filters
        var selectorFilter = fromText("www.foo.com##IMG[src='http://randomimg.com']");
        assert.deepEqual(selectorFilter, fromText("www.foo.com##IMG[src='http://randomimg.com']"));
        assert.strictEqual(selectorFilter, Filter._cache["www.foo.com##IMG[src='http://randomimg.com']"], "should have a cached copy");
        assert.ok(selectorFilter._domains.has['www.foo.com'], "should have the domain");
        assert.strictEqual(selectorFilter.selector, "IMG[src='http://randomimg.com']", "selector should be equal");

    });

    QUnit.module("DomainSet");
    QUnit.test("caching and immutable Filters", function(assert) {
        var text = "safariadblock.com##div"
        var f = Filter.fromText(text);
        assert.strictEqual(f, Filter.fromText(text), "Caching works");
        var fCopy = JSON.parse(JSON.stringify(f));

        var f2 = SelectorFilter.merge(f, [Filter.fromText("safariadblock.com#@#div")]);
        assert.notDeepEqual(f._domains, f2._domains);

        var fSecondCopy = JSON.parse(JSON.stringify(f));
        assert.deepEqual(fCopy, fSecondCopy, "Filters are not mutated by SelectorFilter.merge()");

        assert.strictEqual(f, Filter.fromText(text), "Cached filters aren't affected by subtraction");
    });

    QUnit.test("clone", function(assert) {
        var d = new DomainSet({"": true, "a.com": false, "b.a.com": true});
        var d2 = d.clone();
        assert.notStrictEqual(d, d2);
        assert.deepEqual(d, d2);
    });

    QUnit.test("subtract", function(assert) {

        function _normalize(data) {
            var result = {};
            for (var d in data)
                result[d === 'ALL' ? DomainSet.ALL : d] = data[d];
            return result;
        }
        // Does DomainSet(data1).subtract(DomainSet(data2)) work as expected?
        function _test(data1, data2, result) {
            var set1 = new DomainSet(_normalize(data1));
            set1.subtract( new DomainSet(_normalize(data2)) );
            assert.deepEqual(set1.has, _normalize(result), JSON.stringify(data1) + ' minus ' + JSON.stringify(data2));
        }

        var T = true, F = false;
        _test({ ALL: T, }, { ALL: T }, { ALL: F });
        _test({ ALL: T, }, { ALL: F, 'a': T }, { ALL: T, 'a': F });
        _test({ ALL: F, 'a': T }, { ALL: F, 'a': T }, { ALL: F });
        _test({ ALL: F, 'a': T }, { ALL: F, 'b': T }, { ALL: F, 'a': T });
        _test({ ALL: F, 'a': T }, { ALL: F, 's.a': T }, { ALL: F, 'a': T, 's.a': F});
        _test({ ALL: F, 'a': T, 'c.b.a': F }, { ALL: F, 'b.a': T }, { ALL: F, 'a': T, 'b.a': F });
        _test({ ALL: F, 'a': T, 'd.c.b.a': F }, { ALL: F, 'b.a': T, 'c.b.a': F }, { ALL: F, 'a': T, 'b.a': F, 'c.b.a': T, 'd.c.b.a': F });
        _test({ ALL: T, 'b.a': F }, { ALL: F, 'd': T }, { ALL: T, 'd': F, 'b.a': F });
        _test({ ALL: F, 'b.a': T }, { ALL: T, 'd': F }, { ALL: F });
        _test({ ALL: T, 'b.a': F }, { ALL: T, 'a': F }, { ALL: F, 'a': T, 'b.a': F });
        _test({ ALL: F, 'b.a': T, 'd.c.b.a': F }, { ALL: F, 'a': T, 'c.b.a': F }, {ALL: F, 'c.b.a': T, 'd.c.b.a': F });
        _test({ ALL: F, 'c.b.a': T, 'd.c.b.a': F}, { ALL: F, 'a': T, 'd.a': F }, { ALL: F });
        _test({ ALL: F, 'b.a': T, 'c.b.a': F }, { ALL: F, 'd': T }, { ALL: F, 'b.a': T, 'c.b.a': F });
        _test({ ALL: T, 'b.a': F }, { ALL: F, 'a': T, 'd.a': F }, { ALL: T, 'a': F, 'd.a': T });

    });

    QUnit.test("_computedHas", function(assert) {
        var set1 = new DomainSet({"": false, "s.a": true});
        var set2 = new DomainSet({"": false, "a": true});
        assert.ok(!set1._computedHas("a"), "subdomains don't imply their parents");
        assert.ok(set2._computedHas("s.a"), "domains imply their children");
    });

    QUnit.module("FilterNormalizer");

    QUnit.test("normalizeLine", function(assert) {
        var nl = FilterNormalizer.normalizeLine;
        assert.equal(nl("a##z"), "a##z", "Simple SelectorFilters are OK");
        assert.equal(nl("##[style]"), "~mail.google.com,~mail.yahoo.com##[style]", "[style] bug is handled");
        assert.equal(nl("google.com##[style]"), "~mail.google.com,google.com##[style]", "[style] bug is handled subtlely");
        assert.raises(function() { nl("google.com####[style]"); }, "Bad SelectorFilter throws an exception");
    });

    QUnit.test("_ensureExcluded", function(assert) {
        var entries = [
            { text: "a##z",   domains: [],           expected: "a##z" },
            { text: "##z",    domains: [],           expected: "##z" },
            { text: "##z",    domains: ["a"],        expected: "~a##z" },
            { text: "##z",    domains: ["a", "b"],   expected: "~a,~b##z" },

            { text: "a##z",   domains: [],           expected: "a##z" },
            { text: "a##z",   domains: ["a"],        expected: "~a,a##z" },
            { text: "a##z",   domains: ["a", "b"],   expected: "~a,a##z" },

            { text: "a##z",   domains: ["s.a"],      expected: "~s.a,a##z" },
            { text: "a##z",   domains: ["s.a", "b"], expected: "~s.a,a##z" },
            { text: "a##z",   domains: ["a", "s.b"], expected: "~a,a##z" },

            { text: "s.a##z", domains: [],           expected: "s.a##z" },
            { text: "s.a##z", domains: ["b"],        expected: "s.a##z" },
            { text: "s.a##z", domains: ["a", "b"],   expected: "s.a##z" },
            { text: "s.a##z", domains: ["s.s.a"],    expected: "~s.s.a,s.a##z" },

            { text: "a,b##z", domains: ["a"],        expected: "~a,a,b##z" },
            { text: "a,b##z", domains: ["a"],        expected: "~a,a,b##z" },

            // Excluding a parent of an included child doesn't exclude the child.  This
            // is probably fine.
            { text: "mail.google.com##div[style]", domains: ["google.com"], expected: "mail.google.com##div[style]" },
            { text: "##div[style]", domains: ["mail.google.com", "mail.yahoo.com"], expected: "~mail.google.com,~mail.yahoo.com##div[style]" },
            { text: "ex.com##div[style]", domains: ["mail.google.com", "mail.yahoo.com"], expected: "ex.com##div[style]" },
            { text: "google.com##div[style]", domains: ["mail.google.com", "mail.yahoo.com"], expected: "~mail.google.com,google.com##div[style]" },
        ];

        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            assert.equal(FilterNormalizer._ensureExcluded(entry.text, entry.domains), entry.expected,
                         "_ensureExcluded('" + entry.text + "', ...) -> '" + entry.expected + "'");
        }
    });

    QUnit.module("SelectorFilter");

    QUnit.test("merge", function(assert) {
        function _testEmpty(a, b) {
            var first = SelectorFilter.merge(
                Filter.fromText(a),
                b.map(function(text) { return Filter.fromText(text); })
            );
            var result = new DomainSet({"": false});
            assert.deepEqual(first._domains, result, a + " - " + JSON.stringify(b) + " = nothing");
        }
        function _test(a, b, c) {
            var first = SelectorFilter.merge(
                Filter.fromText(a),
                b.map(function(text) { return Filter.fromText(text); })
            );
            var second = Filter.fromText(c);
            assert.notEqual(first.id, second.id);
            first.id = second.id;
            assert.deepEqual(first, second, a + " - " + JSON.stringify(b) + " = " + c);
        }
        var f = [
            "a.com##div",
            "b.com##div",
            "sub.a.com##div",
            "~a.com##div",
            "##div",
        ];
        assert.strictEqual(SelectorFilter.merge(f[0], undefined), f[0]);
        _testEmpty(f[0], [f[0]]);
        _testEmpty(f[0], [f[4]]);
        _testEmpty(f[0], [f[1], f[2], f[3], f[4]]);
        _testEmpty(f[1], [f[3]]);
        _test(f[0], [f[1]], "a.com##div");
        _test(f[0], [f[2]], "a.com,~sub.a.com##div");
        _test(f[0], [f[3]], "a.com##div");
        _test(f[0], [f[1], f[2], f[3]], "a.com,~sub.a.com##div");
        _test(f[1], [f[2]], f[1]);
    });

    QUnit.module("MyFilters");



    QUnit.test("Should have default filters subscribed on installation", function(assert) {
        assert.expect(4);
        var _myfilters = new MyFilters();

        // Reset _subscriptions to mock newly installed adblock
        _myfilters._subscriptions = undefined;
        _myfilters._updateDefaultSubscriptions();

        var subscriptions = _myfilters._subscriptions;
        assert.ok(subscriptions["adblock_custom"].subscribed, "Adblock Custom filter should be subscribed");
        assert.ok(subscriptions["easylist"].subscribed, "Easylist Filters should be subscribed");

        _myfilters._updateFieldsFromOriginalOptions();
        assert.ok(subscriptions["adblock_custom"].subscribed, "Adblock Custom filter should still be subscribed");
        assert.ok(subscriptions["easylist"].subscribed, "Easylist Filters should still be subscribed");
    });

    QUnit.test("Should delete ex-official lists from subscriptions", function(assert) {
        assert.expect(6);
        var _myfilters = new MyFilters();
        _myfilters._subscriptions = {
            foo: {
                url: "http://foo.com/foo.txt",
                initialUrl: "http://foo.com/foo.txt",
                user_submitted: false,
                subscribed: false
            },
            bar: {
                url: "http://bar.com/bar.txt",
                initialUrl: "http://bar.com/bar.txt",
                user_submitted: true,
                subscribed: true
            },
            minions: {
                url: "https://banana.com/banana.txt",
                initialUrl: "https://banana.com/banana.txt",
                user_submitted: false,
                subscribed: true
            },
            boo: {
                url: "https://mu.com/mu.txt",
                initialUrl: "https://mu.com/mu.txt",
                user_submitted: true,
                subscribed: false
            },
            cheeseburgers: {
                url: "https://canihas.com/canihas.txt",
                initialUrl: "https://canihas.com/canihas.txt",
                user_submitted: false,
                subscribed: false
            },
            "url:http://ramdomsub.com/randomsub.txt": {
                url: "http://ramdomsub.com/randomsub.txt",
                initialUrl: "http://ramdomsub.com/randomsub.txt",
                user_submitted: true
            }
        }

        _myfilters._official_options = {
            bar: { url: "http://bar.com/bar.txt" },
            minions: { url: "https://banana.com/banana.txt" },
            cheeseburgers: { url: "https://canihas.com/canihas.txt" }
        }

        _myfilters._updateDefaultSubscriptions();

        var subscriptions = _myfilters._subscriptions;
        assert.ok(!subscriptions.foo, "Subscription foo should be deleted"); // Not in official list, not user submitted, not subscribed
        assert.ok(subscriptions.bar, "Subscription bar should still exist"); // In official list, user submitted, subscribed
        assert.ok(subscriptions.minions, "Subscription minions should still exist"); // In official list, not user submitted, subscribed
        assert.ok(subscriptions["url:https://mu.com/mu.txt"], "Subscription should change id since it is not in official list");
        assert.ok(subscriptions.cheeseburgers, "Subscription cheeseburger should still exist"); // In official list, not user submitted, not subscribed
        assert.ok(subscriptions["url:http://ramdomsub.com/randomsub.txt"], "Subscription with url as id should still exist"); // Not in official list, user submitted (subscribed is irrelevant)
    });

    QUnit.test("Should change the id of a new official subscriptions", function(assert) {
        var _myfilters = new MyFilters();
        _myfilters._subscriptions = {
            "url:http://foo.com/foo.txt": {
                url: "http://foo.com/foo.txt",
                initialUrl: "http://foo.com/foo.txt",
                user_submitted: true
            },
            "url:http://randomness.com/superrandom.txt": {
                url: "http://randomness.com/superrandom123.txt",
                initialUrl: "http://randomness.com/superrandom.txt",
                user_submitted: true
            },
            "url:https://grue.com/banana.txt": {
                url: "https://grue.com/banana.txt",
                user_submitted: true
            },
            "url:https://banana.com/banana.txt": {
                url: "https://banana.com/banana.txt",
                user_submitted: true
            },
            bar: {
                url: "http://bar.com/bar.txt",
                initialUrl: "http://bar.com/bar.txt",
                user_submitted: true
            },
            notmatch: {
                url: "http://notmatch.com/notmatch.txt",
                subscribed: true,
                user_submitted: false
            },
            ex_official: {
                initialUrl: "http://example.com/ex_official/original.txt",
                url:        "http://example.com/ex_official/recent.txt",
                user_submitted: true
            },
        }

        _myfilters._official_options = {
            foo: { url: "http://foo.com/foo.txt" },
            grue: { url: "http://randomness.com/superrandom.txt" },
            bar: { url: "http://bar.com/bar.txt" },
            minions: { url: "https://grue.com/banana.txt" }
        }

        _myfilters._updateDefaultSubscriptions();

        var subscriptions = _myfilters._subscriptions;

        assert.ok(subscriptions.foo, "Entry should change id to foo"); // No id, url matches entry in official list
        assert.ok(!subscriptions.foo.user_submitted, "Foo should not be user submitted");
        assert.ok(!subscriptions["url:htp://foo.com/foo.txt"], "Entry should be deleted since it is now and official list");

        assert.ok(subscriptions.grue, "Entry should change id to grue"); // No id, initialUrl matches entry in official list
        assert.ok(!subscriptions.grue.user_submitted, "Grue should not be user submitted");

        assert.ok(subscriptions.minions, "Entry should change id to minions"); // No id, url matches entry in official list
        assert.ok(!subscriptions.minions.user_submitted, "Minions should not be user submitted");

        assert.ok(subscriptions["url:https://banana.com/banana.txt"], "Entry will not be changed"); // No id, url and initialUrl has no match in official list
        assert.ok(subscriptions["url:https://banana.com/banana.txt"].user_submitted, "'Url' should be user submitted");

        assert.ok(subscriptions.bar, "Entry will not be changed"); //With Id, url matches entry in official list
        assert.ok(!subscriptions.bar.user_submitted, "Bar should not be user submitted");

        assert.ok(subscriptions["url:http://notmatch.com/notmatch.txt"], "Entry should change id to url:url"); // With Id, subscribed, url and initial url does not match
        assert.ok(subscriptions["url:http://notmatch.com/notmatch.txt"].user_submitted, "'Url' should be user submitted");
        assert.ok(!subscriptions.notmatch, "Entry should be deleted since it is no longer part of the official list");

        assert.ok(subscriptions["url:http://example.com/ex_official/recent.txt"], "Ex-official list is renamed using url, not initialUrl");
    });

    QUnit.test("Should add official subscription in _subscriptions object if missing", function(assert) {
        // Mock changeSubscription() to avoid error
        MyFilters.prototype.changeSubscription = function(arg1, arg2) {
            this._subscriptions[arg1].subscribed = true;
        };

        var _myfilters = new MyFilters();

        _myfilters._subscriptions = {
            foo: {
                url: "http://foo.com/foo.txt",
                initialUrl: "http://foo.com/foo.txt",
                user_submitted: false,
                subscribed: false
            }
        }

        _myfilters._official_options = {
            foo: { url: "http://foo.com/foo.txt" },
            bar: { url: "http://bar.com/bar.txt" }
        }

        _myfilters._updateFieldsFromOriginalOptions();

        var subscriptions = _myfilters._subscriptions;

        assert.ok(subscriptions.bar, "Bar should be added in subscriptions");
        assert.ok(subscriptions.foo, "Foo should be retained in subscriptions");
    });

    QUnit.test("Should update requires list", function(assert) {
        // Mock changeSubscription() to avoid error
        MyFilters.prototype.changeSubscription = function(arg1, arg2) {
            this._subscriptions[arg1].subscribed = true;
        };

        var _myfilters = new MyFilters();

        _myfilters._subscriptions = {
            foo: {
                url: "http://foo.com/foo.txt",
                initialUrl: "http://foo.com/foo.txt",
                user_submitted: false,
                subscribed: false
            },

            bar: {
                url: "http://bar.com/bar.txt",
                initialUrl: "http://bar.com/bar.txt",
                user_submitted: true,
                subscribed: true
            },

            randomEntry: {
                url: "http://randomEntry.com/randomEntry.txt",
                initialUrl: "http://randomEntry.com/randomEntry.txt",
                user_submitted: false,
                subscribed: false,
                requiresList: "anaconda"
            },

            minions: {
                url: "http://minions.com/minions.txt",
                subscribed: false
            },

            eddard: {
                url: "http://starks.com/winteriscoming.txt",
                subscribed: false
            },

            anaconda: {
                url: "http://anaconda.com/bigbigsnakes.txt",
                subscribed: true
            }
        }

        _myfilters._official_options = {
            minions: { url: "http://minions.com/minions.txt" },
            eddard: { url: "http://starks.com/winteriscoming.txt" },
            foo: { url: "http://foo.com/foo.txt", requiresList: "minions" },
            bar: { url: "http://bar.com/bar.txt", requiresList: "eddard" }
        }

        _myfilters._updateFieldsFromOriginalOptions();

        var subscriptions = _myfilters._subscriptions;

        assert.equal(subscriptions.foo.requiresList, "minions", "RequiresList should be minions");
        assert.equal(subscriptions.bar.requiresList, "eddard", "RequiresList should be eddard");
        assert.ok(!subscriptions.minions.subscribed, "Should retain subscribed status if dependent sub is not subscribed");
        assert.ok(subscriptions.eddard.subscribed, "Should be subscribed since dependent sub is subscribed");
        assert.ok(subscriptions.anaconda.subscribed, "Should remain subscribed even if dependent subscription is unsubscribed");
    });

    QUnit.test("Should update url and initial url if initial url does not match official url", function(assert) {
        assert.expect(7);
        // Mock changeSubscription() to avoid error
        MyFilters.prototype.changeSubscription = function(arg1, arg2) {
            this._subscriptions[arg1].subscribed = true;
        };

        var _myfilters = new MyFilters();

        _myfilters._subscriptions = {
            foo: {
                url: "http://ramsey.com/ramsey.txt",
                initialUrl: "http://foo.com/foo.txt",
                user_submitted: false,
                subscribed: false
            },

            bar: {
                url: "http://bar.com/bar.txt",
                initialUrl: "http://notme.com/notme.txt",
                user_submitted: true,
                subscribed: true
            },

            grue: {
                url: "http://randomthings.com/randomthings.txt",
                initialUrl: "http://randomthings.com/randomgthings.txt"
            }
        }

        _myfilters._official_options = {
            foo: { url: "http://foo.com/foo.txt", requiresList: "minions" },
            bar: { url: "http://bar.com/bar.txt", requiresList: "eddard" },
            grue: { url: "http://despicable.com/despicable.txt" },
            minions: { url: "http://minions.com/minons.txt" }
        }

        _myfilters._updateFieldsFromOriginalOptions();

        var subscriptions = _myfilters._subscriptions;
        var officialSubs = _myfilters._official_options;

        assert.equal(subscriptions.foo.initialUrl, officialSubs.foo.url, "Url should be equal");

        assert.equal(subscriptions.bar.url, officialSubs.bar.url, "Url should be equal");
        assert.equal(subscriptions.bar.initialUrl, officialSubs.bar.url, "Url should be equal");

        assert.equal(subscriptions.grue.url, officialSubs.grue.url, "Url should be equal");
        assert.equal(subscriptions.grue.initialUrl, officialSubs.grue.url, "Url should be equal");

        assert.equal(subscriptions.minions.url, officialSubs.minions.url, "Missing subs should be added");
        assert.equal(subscriptions.minions.initialUrl, officialSubs.minions.url, "Missing subs should be added");
    });

    if (/Chrome/.test(navigator.userAgent)) {
        // CHROME ONLY

        QUnit.test("Should instantiate a MyFilters object correctly", function(assert) {
            assert.expect(3);
            //Tests if instance of MyFilters was instantiated successfully
            //Since get / set storage on Safari is mocked up, this shouldn't run on Safari, only Chrome
            var _myfilters = new MyFilters();
            assert.ok(_myfilters, "MyFilters created successfully");
            assert.ok(_myfilters._subscriptions, "_subscriptions is not null");
            assert.ok(_myfilters._official_options, "_official_options is not null");
        });

        (function() {
            QUnit.module("Purging the remainders of ads using CSS selectors");

            function runme(page, url) {
                elementPurger._page_location = new parseURI(page);
                return elementPurger._srcsFor(url);
            }

            QUnit.test("Fragments behind URLs", function(assert) {
                assert.expect(4);
                assert.deepEqual(runme("http://a.com/b/c/d.html#e", "http://a.com/b/c/d.html#f"), [
                    {"op": "$=", "text": "//a.com/b/c/d.html#f"},
                    {"op": "=", "text": "/b/c/d.html#f"},
                    {"op": "=", "text": "d.html#f"},
                    {"op": "=", "text": "./d.html#f"}]);
                assert.deepEqual(runme("http://a.com/b/c/d.html#e/f/g", "http://a.com/b/c/d.html#a/b/c/d/e/f"), [
                    {"op": "$=", "text": "//a.com/b/c/d.html#a/b/c/d/e/f"},
                    {"op": "=", "text": "/b/c/d.html#a/b/c/d/e/f"},
                    {"op": "=", "text": "d.html#a/b/c/d/e/f"},
                    {"op": "=", "text": "./d.html#a/b/c/d/e/f"}]);
                assert.deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/c/e.html#f"), [
                    {"op": "$=", "text": "//a.com/b/c/e.html#f"},
                    {"op": "=", "text": "/b/c/e.html#f"},
                    {"op": "=", "text": "e.html#f"},
                    {"op": "=", "text": "./e.html#f"}]);
                assert.deepEqual(runme("http://a.com/b/c/#", "http://a.com/b/c/d/#"), [
                    {"op": "$=", "text": "//a.com/b/c/d/#"},
                    {"op": "=", "text": "/b/c/d/"},
                    {"op": "=", "text": "d/"},
                    {"op": "=", "text": "./d/"}]);
            });

            QUnit.test("Ignore queryparameters in page but not in url", function(assert) {
                assert.expect(2);
                assert.deepEqual(runme("http://a.com/b/c/d.html?e/f/g/h#i/j", "http://a.com/b/c/k.html?l/m#n#o"), [
                    {"op": "$=", "text": "//a.com/b/c/k.html?l/m#n#o"},
                    {"op": "=", "text": "/b/c/k.html?l/m#n#o"},
                    {"op": "=", "text": "k.html?l/m#n#o"},
                    {"op": "=", "text": "./k.html?l/m#n#o"}]);
                assert.deepEqual(runme("http://a.com/b/c/d.html?e/f/g/h#i/j", "http://a.com/b/c/k.html?/l/m#n#o"), [
                    {"op": "$=", "text": "//a.com/b/c/k.html?/l/m#n#o"},
                    {"op": "=", "text": "/b/c/k.html?/l/m#n#o"},
                    {"op": "=", "text": "k.html?/l/m#n#o"},
                    {"op": "=", "text": "./k.html?/l/m#n#o"}]);
            });

            QUnit.test("Different domains", function(assert) {
                assert.expect(2);
                assert.deepEqual(runme("http://a.com/b/c/d.html", "http://e.com/f.html"), [
                    {"op": "$=", "text": "//e.com/f.html"}]);
                assert.deepEqual(runme("http://a.com/b/c/d.html", "http://e.com/f.html#http://g.com/h/i/#j#k#l"), [
                    {"op": "$=", "text": "//e.com/f.html#http://g.com/h/i/#j#k#l"}]);
            });

            QUnit.test("Same directory", function(assert) {
                assert.expect(2);
                assert.deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/c/d.html"), [
                    {"op": "$=", "text": "//a.com/b/c/d.html"},
                    {"op": "=", "text": "/b/c/d.html"},
                    {"op": "=", "text": "d.html"},
                    {"op": "=", "text": "./d.html"}]);
                assert.deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/c/e.html"), [
                    {"op": "$=", "text": "//a.com/b/c/e.html"},
                    {"op": "=", "text": "/b/c/e.html"},
                    {"op": "=", "text": "e.html"},
                    {"op": "=", "text": "./e.html"}]);
            });

            QUnit.test("Different documents in parent directories", function(assert) {
                assert.expect(3);
                assert.deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/e.html"), [
                    {"op": "$=", "text": "//a.com/b/e.html"},
                    {"op": "=", "text": "/b/e.html"},
                    {"op": "$=", "text": "../e.html"}]);
                assert.deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/e.html"), [
                    {"op": "$=", "text": "//a.com/e.html"},
                    {"op": "=", "text": "/e.html"},
                    {"op": "$=", "text": "../../e.html"}]);
                assert.deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/"), [
                    {"op": "$=", "text": "//a.com/"},
                    {"op": "=", "text": "/"},
                    {"op": "$=", "text": "../../"}]);
            });

            QUnit.test("Different doc in subdirs of same or parent dir", function(assert) {
                assert.expect(2);
                assert.deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/c/e/f/g.html"), [
                    {"op": "$=", "text": "//a.com/b/c/e/f/g.html"},
                    {"op": "=", "text": "/b/c/e/f/g.html"},
                    {"op": "=", "text": "e/f/g.html"},
                    {"op": "=", "text": "./e/f/g.html"}]);
                assert.deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/e/f/g.html"), [
                    {"op": "$=", "text": "//a.com/b/e/f/g.html"},
                    {"op": "=", "text": "/b/e/f/g.html"},
                    {"op": "$=", "text": "../e/f/g.html"}]);
            });

            QUnit.test("Empty page dir", function(assert) {
                assert.expect(3);
                assert.deepEqual(runme("http://a.com/b/c/", "http://a.com/b/c/d/e.html"), [
                    {"op": "$=", "text": "//a.com/b/c/d/e.html"},
                    {"op": "=", "text": "/b/c/d/e.html"},
                    {"op": "=", "text": "d/e.html"},
                    {"op": "=", "text": "./d/e.html"}]);
                assert.deepEqual(runme("http://a.com/b/c/", "http://a.com/b/c/d.html"), [
                    {"op": "$=", "text": "//a.com/b/c/d.html"},
                    {"op": "=", "text": "/b/c/d.html"},
                    {"op": "=", "text": "d.html"},
                    {"op": "=", "text": "./d.html"}]);
                assert.deepEqual(runme("http://a.com/b/c/", "http://a.com/b/"), [
                    {"op": "$=", "text": "//a.com/b/"},
                    {"op": "=", "text": "/b/"},
                    {"op": "$=", "text": "../"}]);
            });

            QUnit.test("Lack of trailing url slash", function(assert) {
                assert.expect(2);
                assert.deepEqual(runme("http://a.com/b/c/", "http://a.com/b"), [
                    {"op": "$=", "text": "//a.com/b"},
                    {"op": "=", "text": "/b"},
                    {"op": "$=", "text": "../../b"}]);
                assert.deepEqual(runme("http://a.com/b/c/", "http://a.com/b/c"), [
                    {"op": "$=", "text": "//a.com/b/c"},
                    {"op": "=", "text": "/b/c"},
                    {"op": "$=", "text": "../c"}]);
            });
        })();

        // END CHROME ONLY
    } else {
        // SAFARI ONLY

        // END SAFARI ONLY
    }
});