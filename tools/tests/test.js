

module("General");
test("Using extension domain", 1, function() {
  ok(window.chrome && chrome.extension, "This test suite should be running on an extension URL");
});

module("Parsing URLs: parseURI");
test("parseUri", 17, function() {
  deepEqual(parseUri("https://foo.bar/"), {"hash": "", "host": "foo.bar", "hostname": "foo.bar", "href": "https://foo.bar/", "origin": "https://foo.bar", "pathname": "/", "port": "", "protocol": "https:", "search": ""});
  deepEqual(parseUri("https://foo.bar:80/"), {"hash": "", "host": "foo.bar:80", "hostname": "foo.bar", "href": "https://foo.bar:80/", "origin": "https://foo.bar:80", "pathname": "/", "port": "80", "protocol": "https:", "search": ""});
  deepEqual(parseUri("https://foo.bar/?http://www.google.nl/search?"), {"hash": "", "host": "foo.bar", "hostname": "foo.bar", "href": "https://foo.bar/?http://www.google.nl/search?", "origin": "https://foo.bar", "pathname": "/", "port": "", "protocol": "https:", "search": "?http://www.google.nl/search?"});
  deepEqual(parseUri("https:foo.bar/?http://www.google.nl/search?"), {"hash": "", "host": "foo.bar", "hostname": "foo.bar", "href": "https:foo.bar/?http://www.google.nl/search?", "origin": "https:foo.bar", "pathname": "/", "port": "", "protocol": "https:", "search": "?http://www.google.nl/search?"});
  deepEqual(parseUri("http://usr:@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"), {"hash": "#top", "host": "www.test.com:81", "hostname": "www.test.com", "href": "http://usr:@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top", "origin": "http://usr:@www.test.com:81", "pathname": "/dir/dir.2/index.htm", "port": "81", "protocol": "http:", "search": "?q1=0&&test1&test2=value"});
  deepEqual(parseUri("http://usr:pass@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"), {"hash": "#top", "host": "www.test.com:81", "hostname": "www.test.com", "href": "http://usr:pass@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top", "origin": "http://usr:pass@www.test.com:81", "pathname": "/dir/dir.2/index.htm", "port": "81", "protocol": "http:", "search": "?q1=0&&test1&test2=value"});
  deepEqual(parseUri("http://usr:pass@www.test.com/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"), {"hash": "#top", "host": "www.test.com", "hostname": "www.test.com", "href": "http://usr:pass@www.test.com/dir/dir.2/index.htm?q1=0&&test1&test2=value#top", "origin": "http://usr:pass@www.test.com", "pathname": "/dir/dir.2/index.htm", "port": "", "protocol": "http:", "search": "?q1=0&&test1&test2=value"});
  deepEqual(parseUri("http://www.test.com/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"), {"hash": "#top", "host": "www.test.com", "hostname": "www.test.com", "href": "http://www.test.com/dir/dir.2/index.htm?q1=0&&test1&test2=value#top", "origin": "http://www.test.com", "pathname": "/dir/dir.2/index.htm", "port": "", "protocol": "http:", "search": "?q1=0&&test1&test2=value"});
  deepEqual(parseUri("http://www.test.com/dir/dir@2/index.htm#top"), {"hash": "#top", "host": "www.test.com", "hostname": "www.test.com", "href": "http://www.test.com/dir/dir@2/index.htm#top", "origin": "http://www.test.com", "pathname": "/dir/dir@2/index.htm", "port": "", "protocol": "http:", "search": ""});
  deepEqual(parseUri("http://www.test.com/dir/dir@2/index#top"), {"hash": "#top", "host": "www.test.com", "hostname": "www.test.com", "href": "http://www.test.com/dir/dir@2/index#top", "origin": "http://www.test.com", "pathname": "/dir/dir@2/index", "port": "", "protocol": "http:", "search": ""});
  deepEqual(parseUri("http://test.com/dir/dir@2/#top"), {"hash": "#top", "host": "test.com", "hostname": "test.com", "href": "http://test.com/dir/dir@2/#top", "origin": "http://test.com", "pathname": "/dir/dir@2/", "port": "", "protocol": "http:", "search": ""});
  deepEqual(parseUri("http://www.test.com/dir/dir@2/?top"), {"hash": "", "host": "www.test.com", "hostname": "www.test.com", "href": "http://www.test.com/dir/dir@2/?top", "origin": "http://www.test.com", "pathname": "/dir/dir@2/", "port": "", "protocol": "http:", "search": "?top"});
  deepEqual(parseUri("http://www.test.com/dir/dir@2/"), {"hash": "", "host": "www.test.com", "hostname": "www.test.com", "href": "http://www.test.com/dir/dir@2/", "origin": "http://www.test.com", "pathname": "/dir/dir@2/", "port": "", "protocol": "http:", "search": ""});
  deepEqual(parseUri("feed:https://www.test.com/dir/dir@2/"), {"hash": "", "host": "www.test.com", "hostname": "www.test.com", "href": "feed:https://www.test.com/dir/dir@2/", "origin": "feed:https://www.test.com", "pathname": "/dir/dir@2/", "port": "", "protocol": "feed:", "search": ""});
  deepEqual(parseUri("feed:https://www.test.com:80/dir/dir@2/"), {"hash": "", "host": "www.test.com:80", "hostname": "www.test.com", "href": "feed:https://www.test.com:80/dir/dir@2/", "origin": "feed:https://www.test.com:80", "pathname": "/dir/dir@2/", "port": "80", "protocol": "feed:", "search": ""});
  deepEqual(parseUri("feed:https://www.test.com/dir/dir2/?http://foo.bar/"), {"hash": "", "host": "www.test.com", "hostname": "www.test.com", "href": "feed:https://www.test.com/dir/dir2/?http://foo.bar/", "origin": "feed:https://www.test.com", "pathname": "/dir/dir2/", "port": "", "protocol": "feed:", "search": "?http://foo.bar/"});
  deepEqual(parseUri("chrome-extension://longidentifier/tools/tests/index.html?notrycatch=true"), {"hash": "", "host": "longidentifier", "hostname": "longidentifier", "href": "chrome-extension://longidentifier/tools/tests/index.html?notrycatch=true", "origin": "chrome-extension://longidentifier", "pathname": "/tools/tests/index.html", "port": "", "protocol": "chrome-extension:", "search": "?notrycatch=true"});
});
test("parseSearch", 11, function() {
  deepEqual(parseUri.parseSearch("?hello=world&ext=adblock&time=bedtime"), {"ext": "adblock", "hello": "world", "time": "bedtime"});
  deepEqual(parseUri.parseSearch(""), {});
  deepEqual(parseUri.parseSearch("?"), {});
  deepEqual(parseUri.parseSearch("?hello"), {"hello": ""});
  deepEqual(parseUri.parseSearch("?hello=world"), {"hello": "world"});
  deepEqual(parseUri.parseSearch("?hello&ext=adblock"), {"ext": "adblock", "hello": ""});
  deepEqual(parseUri.parseSearch("?ext=adblock&hello"), {"ext": "adblock", "hello": ""});
  deepEqual(parseUri.parseSearch("?hello=world&hello=earth"), {"hello": "earth"});
  deepEqual(parseUri.parseSearch("?hello=&ext=adblock"), {"ext": "adblock", "hello": ""});
  deepEqual(parseUri.parseSearch("?hello=world&&ext=adblock"), {"ext": "adblock", "hello": "world"});
  deepEqual(parseUri.parseSearch("?hello&&&&ext=adblock"), {"ext": "adblock", "hello": ""});
});

test("parseSecondLevelDomain", 5, function() {
  var secondLevelDomainOnly = parseUri.secondLevelDomainOnly;
  deepEqual(secondLevelDomainOnly("appspot.google.com"), "google.com");
  deepEqual(secondLevelDomainOnly("foo.bar.com"), "bar.com");
  deepEqual(secondLevelDomainOnly("https://www.google.com.ph"), "com.ph");
  deepEqual(secondLevelDomainOnly("http://usr:pass@www.test.com:81/dir"), "test.com:81/dir");
  deepEqual(secondLevelDomainOnly("http://support.godaddy.com"), "godaddy.com");
});

module("Global Functions");
test("storage get and storage set", function() {
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
  deepEqual(testObj.foo, testResultObj.foo);
  deepEqual(testObj.bar, testResultObj.bar);
  deepEqual(testObj, testResultObj);
  
  notEqual(testObj, testResultObj);
  
  storage_set("foo", testObj.foo);
  var foo = storage_get("foo");
  deepEqual(testObj.foo, foo);
  strictEqual(testObj.foo, foo);
  equal(testObj.foo, foo);
  
  storage_set("foo", "not foo");
  foo = storage_get("foo");
  notDeepEqual(testObj.foo, foo);
  notStrictEqual(testObj.foo, foo);
  notEqual(testObj.foo, foo);
  
  testObj.foo = "not foo";
  testObj.bar = "not bar";
  testResultObj = storage_get("testObj");
  notDeepEqual(testObj.foo, testResultObj.foo);
  notDeepEqual(testObj.bar, testResultObj.bar);
  notDeepEqual(testObj, testResultObj);
});

test("setDefault", function() {
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
  
  strictEqual(testMap.first, first);
  notStrictEqual(testMap.first, "noOne");
  
  first = setDefault(testMap, "notHere", testObj);
  
  deepEqual(testMap.notHere, testObj);
  deepEqual(first, testObj);
  deepEqual(first, testMap.notHere);
  ok(testMap.notHere == testObj && testMap.notHere== first, "should be the same object");
  
  testObj = {
    bar: "foo",
  }
  
  first = setDefault(testMap, "notHere", testObj);
  notDeepEqual(testMap.notHere, testObj);
  notDeepEqual(first, testObj);
  ok(testMap.notHere != testObj && first != testObj, "should not be the same");
});

module("FilterTypes");
test("selector filter", function() {
  var isSelectorFilter = Filter.isSelectorFilter;
  ok(isSelectorFilter("www.foo.com##IMG[src='http://randomimg.com']"), "Is a selector filter");
  ok(isSelectorFilter("www.foo.com#@#IMG[src='http://randomimg.com']"), "Is an exclude selector filter");
  ok(!isSelectorFilter("www.foo.com#@IMG[src='http://randomimg.com']"), "Is not a selector filter");
});

test("exclude selector filter", function() {
  var isSelectorExcludeFilter = Filter.isSelectorExcludeFilter;
  ok(!isSelectorExcludeFilter("www.foo.com##IMG[src='http://randomimg.com']"), "Is not an exclude selector filter");
  ok(isSelectorExcludeFilter("www.foo.com#@#IMG[src='http://randomimg.com']"), "Is an exclude selector filter");
  ok(!isSelectorExcludeFilter("www.foo.com#@IMG[src='http://randomimg.com']"), "Is not an exclude selector filter");
});

test("whitelist filter", function() {
  var isWhitelistFilter = Filter.isWhitelistFilter;
  ok(!isWhitelistFilter("www.foo.com@@IMG[src='http://randomimg.com']"), "Is not a whitelist filter");
  ok(isWhitelistFilter("@@IMG[src='http://randomimg.com']"), "Is a whitelist filter");
});

test("comment", function() {
  var isComment = Filter.isComment;
  ok(isComment("! foo comment"), "comment that starts with '!'");
  ok(isComment("[adblock foo comment"), "comment that starts with '[adblock'");
  ok(isComment("(adblock foo comment"), "comment that starts with '(adblock'");
  
  ok(!isComment(" ! foo comment"), "comment that does not start with '!'");
  ok(!isComment(" [ adblock foo comment"), "comment that does not start with '[adblock'");
  ok(!isComment(" ( adblock foo comment"), "comment that does not start with '(adblock'");
});

test("create selector filter from text", function() {
  var fromText = Filter.fromText;
  ok(fromText("www.foo.com##IMG[src='http://randomimg.com']") instanceof SelectorFilter, "is a SelectorFilter object");
  ok(fromText("www.foo.com#@#IMG[src='http://randomimg.com']") instanceof SelectorFilter, "is a SelectorFilter object");
  ok(!(fromText("www.foo.com#@IMG[src='http://randomimg.com']") instanceof SelectorFilter), "is not a SelectorFilter object");
  
  // Test selector filters
  var selectorFilter = fromText("www.foo.com##IMG[src='http://randomimg.com']");
  deepEqual(selectorFilter, fromText("www.foo.com##IMG[src='http://randomimg.com']"));
  strictEqual(selectorFilter, Filter._cache["www.foo.com##IMG[src='http://randomimg.com']"], "should have a cached copy");
  ok(selectorFilter._domains.has['www.foo.com'], "should have the domain");
  strictEqual(selectorFilter.selector, "IMG[src='http://randomimg.com']", "selector should be equal");
  
});

module("DomainSet");
test("caching and immutable Filters", function() {
  var text = "safariadblock.com##div" 
  var f = Filter.fromText(text);
  strictEqual(f, Filter.fromText(text), "Caching works");
  var fCopy = JSON.parse(JSON.stringify(f));

  var f2 = SelectorFilter.merge(f, [Filter.fromText("safariadblock.com#@#div")]);
  notDeepEqual(f._domains, f2._domains);

  var fSecondCopy = JSON.parse(JSON.stringify(f));
  deepEqual(fCopy, fSecondCopy, "Filters are not mutated by SelectorFilter.merge()");

  strictEqual(f, Filter.fromText(text), "Cached filters aren't affected by subtraction");
});

test("clone", function() {
  var d = new DomainSet({"": true, "a.com": false, "b.a.com": true});
  var d2 = d.clone();
  notStrictEqual(d, d2);
  deepEqual(d, d2);
});

test("subtract", function() {

  var _normalize = function(data) {
    var result = {};
    for (var d in data)
      result[d === 'ALL' ? DomainSet.ALL : d] = data[d];
    return result;
  }
  // Does DomainSet(data1).subtract(DomainSet(data2)) work as expected?
  var _test = function(data1, data2, result) {
    var set1 = new DomainSet(_normalize(data1));
    set1.subtract( new DomainSet(_normalize(data2)) );
    deepEqual(set1.has, _normalize(result), JSON.stringify(data1) + ' minus ' + JSON.stringify(data2));
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

test("_computedHas", function() {
  var set1 = new DomainSet({"": false, "s.a": true});
  var set2 = new DomainSet({"": false, "a": true});
  ok(!set1._computedHas("a"), "subdomains don't imply their parents");
  ok(set2._computedHas("s.a"), "domains imply their children");
});

module("FilterNormalizer");

test("normalizeLine", function() {
  var nl = FilterNormalizer.normalizeLine;
  equal(nl("a##z"), "a##z", "Simple SelectorFilters are OK");
  equal(nl("##[style]"), "~mail.google.com,~mail.yahoo.com##[style]", "[style] bug is handled");
  equal(nl("google.com##[style]"), "~mail.google.com,google.com##[style]", "[style] bug is handled subtlely");
  raises(function() { nl("google.com####[style]"); }, "Bad SelectorFilter throws an exception");
});

test("_ensureExcluded", function() {
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
    equal(FilterNormalizer._ensureExcluded(entry.text, entry.domains), entry.expected,
          "_ensureExcluded('" + entry.text + "', ...) -> '" + entry.expected + "'");
  }
});

module("SelectorFilter");

test("merge", function() {
  var _testEmpty = function(a, b) {
    var first = SelectorFilter.merge(
      Filter.fromText(a), 
      b.map(function(text) { return Filter.fromText(text); })
    );
    var result = new DomainSet({"": false});
    deepEqual(first._domains, result, a + " - " + JSON.stringify(b) + " = nothing");
  }
  var _test = function(a, b, c) {
    var first = SelectorFilter.merge(
      Filter.fromText(a), 
      b.map(function(text) { return Filter.fromText(text); })
    );
    var second = Filter.fromText(c);
    notEqual(first.id, second.id);
    first.id = second.id;
    deepEqual(first, second, a + " - " + JSON.stringify(b) + " = " + c);
  }
  var f = [
    "a.com##div",
    "b.com##div",
    "sub.a.com##div",
    "~a.com##div",
    "##div",
  ];
  strictEqual(SelectorFilter.merge(f[0], undefined), f[0]);
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

module("MyFilters");



test("Should have default filters subscribed on installation", 4, function() {
  var _myfilters = new MyFilters();
  
  // Reset _subscriptions to mock newly installed adblock
  _myfilters._subscriptions = undefined;
  _myfilters._updateDefaultSubscriptions();
  
  var subscriptions = _myfilters._subscriptions;
  ok(subscriptions["adblock_custom"].subscribed, "Adblock Custom filter should be subscribed");
  ok(subscriptions["easylist"].subscribed, "Easylist Filters should be subscribed");
  
  _myfilters._updateFieldsFromOriginalOptions();
  ok(subscriptions["adblock_custom"].subscribed, "Adblock Custom filter should still be subscribed");
  ok(subscriptions["easylist"].subscribed, "Easylist Filters should still be subscribed");
});

test("Should delete ex-official lists from subscriptions", 6, function() {
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
  ok(!subscriptions.foo, "Subscription foo should be deleted"); // Not in official list, not user submitted, not subscribed
  ok(subscriptions.bar, "Subscription bar should still exist"); // In official list, user submitted, subscribed
  ok(subscriptions.minions, "Subscription minions should still exist"); // In official list, not user submitted, subscribed
  ok(subscriptions["url:https://mu.com/mu.txt"], "Subscription should change id since it is not in official list");
  ok(subscriptions.cheeseburgers, "Subscription cheeseburger should still exist"); // In official list, not user submitted, not subscribed
  ok(subscriptions["url:http://ramdomsub.com/randomsub.txt"], "Subscription with url as id should still exist"); // Not in official list, user submitted (subscribed is irrelevant)
});

test("Should change the id of a new official subscriptions", function() { 
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
  
  ok(subscriptions.foo, "Entry should change id to foo"); // No id, url matches entry in official list
  ok(!subscriptions.foo.user_submitted, "Foo should not be user submitted");
  ok(!subscriptions["url:htp://foo.com/foo.txt"], "Entry should be deleted since it is now and official list");
  
  ok(subscriptions.grue, "Entry should change id to grue"); // No id, initialUrl matches entry in official list
  ok(!subscriptions.grue.user_submitted, "Grue should not be user submitted");
  
  ok(subscriptions.minions, "Entry should change id to minions"); // No id, url matches entry in official list
  ok(!subscriptions.minions.user_submitted, "Minions should not be user submitted");
  
  ok(subscriptions["url:https://banana.com/banana.txt"], "Entry will not be changed"); // No id, url and initialUrl has no match in official list
  ok(subscriptions["url:https://banana.com/banana.txt"].user_submitted, "'Url' should be user submitted");
  
  ok(subscriptions.bar, "Entry will not be changed"); //With Id, url matches entry in official list
  ok(!subscriptions.bar.user_submitted, "Bar should not be user submitted");
  
  ok(subscriptions["url:http://notmatch.com/notmatch.txt"], "Entry should change id to url:url"); // With Id, subscribed, url and initial url does not match
  ok(subscriptions["url:http://notmatch.com/notmatch.txt"].user_submitted, "'Url' should be user submitted");
  ok(!subscriptions.notmatch, "Entry should be deleted since it is no longer part of the official list");

  ok(subscriptions["url:http://example.com/ex_official/recent.txt"], "Ex-official list is renamed using url, not initialUrl");
});

test("Should add official subscription in _subscriptions object if missing", function() {
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
  
  ok(subscriptions.bar, "Bar should be added in subscriptions");
  ok(subscriptions.foo, "Foo should be retained in subscriptions");
});

test("Should update requires list", function() {
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
  
  equal(subscriptions.foo.requiresList, "minions", "RequiresList should be minions");
  equal(subscriptions.bar.requiresList, "eddard", "RequiresList should be eddard");
  ok(!subscriptions.minions.subscribed, "Should retain subscribed status if dependent sub is not subscribed");
  ok(subscriptions.eddard.subscribed, "Should be subscribed since dependent sub is subscribed");
  ok(subscriptions.anaconda.subscribed, "Should remain subscribed even if dependent subscription is unsubscribed");
});

test("Should update url and initial url if initial url does not match official url", 7, function() {
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
  
  equal(subscriptions.foo.initialUrl, officialSubs.foo.url, "Url should be equal");
  
  equal(subscriptions.bar.url, officialSubs.bar.url, "Url should be equal");
  equal(subscriptions.bar.initialUrl, officialSubs.bar.url, "Url should be equal");
  
  equal(subscriptions.grue.url, officialSubs.grue.url, "Url should be equal");
  equal(subscriptions.grue.initialUrl, officialSubs.grue.url, "Url should be equal");
  
  equal(subscriptions.minions.url, officialSubs.minions.url, "Missing subs should be added");
  equal(subscriptions.minions.initialUrl, officialSubs.minions.url, "Missing subs should be added");
});

if (/Chrome/.test(navigator.userAgent)) {
  // CHROME ONLY
  
  test("Should instantiate a MyFilters object correctly", 3, function() {
      //Tests if instance of MyFilters was instantiated successfully
      //Since get / set storage on Safari is mocked up, this shouldn't run on Safari, only Chrome
      var _myfilters = new MyFilters();
      ok(_myfilters, "MyFilters created successfully");
      ok(_myfilters._subscriptions, "_subscriptions is not null");
      ok(_myfilters._official_options, "_official_options is not null");
    });
  
  (function() {
    module("Purging the remainders of ads using CSS selectors");
    
    function runme(page, url) {
      elementPurger._page_location = parseUri(page);
      return elementPurger._srcsFor(url);
    }
    
    test("Fragments behind URLs", 4, function() {
      deepEqual(runme("http://a.com/b/c/d.html#e", "http://a.com/b/c/d.html#f"), [
                {"op": "$=", "text": "//a.com/b/c/d.html#f"},
                {"op": "=", "text": "/b/c/d.html#f"},
                {"op": "=", "text": "d.html#f"},
                {"op": "=", "text": "./d.html#f"}]);
      deepEqual(runme("http://a.com/b/c/d.html#e/f/g", "http://a.com/b/c/d.html#a/b/c/d/e/f"), [
                {"op": "$=", "text": "//a.com/b/c/d.html#a/b/c/d/e/f"},
                {"op": "=", "text": "/b/c/d.html#a/b/c/d/e/f"},
                {"op": "=", "text": "d.html#a/b/c/d/e/f"},
                {"op": "=", "text": "./d.html#a/b/c/d/e/f"}]);
      deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/c/e.html#f"), [
                {"op": "$=", "text": "//a.com/b/c/e.html#f"},
                {"op": "=", "text": "/b/c/e.html#f"},
                {"op": "=", "text": "e.html#f"},
                {"op": "=", "text": "./e.html#f"}]);
      deepEqual(runme("http://a.com/b/c/#", "http://a.com/b/c/d/#"), [
                {"op": "$=", "text": "//a.com/b/c/d/#"},
                {"op": "=", "text": "/b/c/d/#"},
                {"op": "=", "text": "d/#"},
                {"op": "=", "text": "./d/#"}]);
    });
    
    test("Ignore queryparameters in page but not in url", 2, function() {
      deepEqual(runme("http://a.com/b/c/d.html?e/f/g/h#i/j", "http://a.com/b/c/k.html?l/m#n#o"), [
                {"op": "$=", "text": "//a.com/b/c/k.html?l/m#n#o"},
                {"op": "=", "text": "/b/c/k.html?l/m#n#o"},
                {"op": "=", "text": "k.html?l/m#n#o"},
                {"op": "=", "text": "./k.html?l/m#n#o"}]);
      deepEqual(runme("http://a.com/b/c/d.html?e/f/g/h#i/j", "http://a.com/b/c/k.html?/l/m#n#o"), [
                {"op": "$=", "text": "//a.com/b/c/k.html?/l/m#n#o"},
                {"op": "=", "text": "/b/c/k.html?/l/m#n#o"},
                {"op": "=", "text": "k.html?/l/m#n#o"},
                {"op": "=", "text": "./k.html?/l/m#n#o"}]);
    });
    
    test("Different domains", 2, function() {
      deepEqual(runme("http://a.com/b/c/d.html", "http://e.com/f.html"), [
                {"op": "$=", "text": "//e.com/f.html"}]);
      deepEqual(runme("http://a.com/b/c/d.html", "http://e.com/f.html#http://g.com/h/i/#j#k#l"), [
                {"op": "$=", "text": "//e.com/f.html#http://g.com/h/i/#j#k#l"}]);
    });
    
    test("Same directory", 2, function() {
      deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/c/d.html"), [
                {"op": "$=", "text": "//a.com/b/c/d.html"},
                {"op": "=", "text": "/b/c/d.html"},
                {"op": "=", "text": "d.html"},
                {"op": "=", "text": "./d.html"}]);
      deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/c/e.html"), [
                {"op": "$=", "text": "//a.com/b/c/e.html"},
                {"op": "=", "text": "/b/c/e.html"},
                {"op": "=", "text": "e.html"},
                {"op": "=", "text": "./e.html"}]);
    });
    
    test("Different documents in parent directories", 3, function() {
      deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/e.html"), [
                {"op": "$=", "text": "//a.com/b/e.html"},
                {"op": "=", "text": "/b/e.html"},
                {"op": "$=", "text": "../e.html"}]);
      deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/e.html"), [
                {"op": "$=", "text": "//a.com/e.html"},
                {"op": "=", "text": "/e.html"},
                {"op": "$=", "text": "../../e.html"}]);
      deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/"), [
                {"op": "$=", "text": "//a.com/"},
                {"op": "=", "text": "/"},
                {"op": "$=", "text": "../../"}]);
    });
    
    test("Different doc in subdirs of same or parent dir", 2, function() {
      deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/c/e/f/g.html"), [
                {"op": "$=", "text": "//a.com/b/c/e/f/g.html"},
                {"op": "=", "text": "/b/c/e/f/g.html"},
                {"op": "=", "text": "e/f/g.html"},
                {"op": "=", "text": "./e/f/g.html"}]);
      deepEqual(runme("http://a.com/b/c/d.html", "http://a.com/b/e/f/g.html"), [
                {"op": "$=", "text": "//a.com/b/e/f/g.html"},
                {"op": "=", "text": "/b/e/f/g.html"},
                {"op": "$=", "text": "../e/f/g.html"}]);
    });
    
    test("Empty page dir", 3, function() {
      deepEqual(runme("http://a.com/b/c/", "http://a.com/b/c/d/e.html"), [
                {"op": "$=", "text": "//a.com/b/c/d/e.html"},
                {"op": "=", "text": "/b/c/d/e.html"},
                {"op": "=", "text": "d/e.html"},
                {"op": "=", "text": "./d/e.html"}]);
      deepEqual(runme("http://a.com/b/c/", "http://a.com/b/c/d.html"), [
                {"op": "$=", "text": "//a.com/b/c/d.html"},
                {"op": "=", "text": "/b/c/d.html"},
                {"op": "=", "text": "d.html"},
                {"op": "=", "text": "./d.html"}]);
      deepEqual(runme("http://a.com/b/c/", "http://a.com/b/"), [
                {"op": "$=", "text": "//a.com/b/"},
                {"op": "=", "text": "/b/"},
                {"op": "$=", "text": "../"}]);
    });
    
    test("Lack of trailing url slash", 2, function() {
      deepEqual(runme("http://a.com/b/c/", "http://a.com/b"), [
                {"op": "$=", "text": "//a.com/b"},
                {"op": "=", "text": "/b"},
                {"op": "$=", "text": "../../b"}]);
      deepEqual(runme("http://a.com/b/c/", "http://a.com/b/c"), [
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
