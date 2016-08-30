(function() {

    function assert_eq(o1, o2) {
        var fail = false;
        [[o1, o2], [o2, o1]].forEach(function(objects) {
            var a = objects[0], b = objects[1];
            for (property in a) {
                if (a[property] !== b[property]) {
                    fail = true;
                }
            }
        });
        if (fail) {
            var o1_s = JSON.stringify(o1);
            var o2_s = JSON.stringify(o2);
            if (o1_s !== o2_s) {
                console.log(o1_s + " != " + o2_s);
            }
        }
    }

    function test_catblock() {
        var pic1 = { x: 10, y: 6, left: 2, top: 2, right: 5, bot: 1 };

        // targets
        var t1 = { x: 10, y: 14 };
        var t2 = { x: 2, y: 13 };
        var t3 = { x: 5, y: 2 };

        // expected results
        var expect1 = { x: 23, y: 14, width: 10, height: 14, left: 4, top: 0, offsetleft: 0, offsettop: 0 };
        var expect2 = { x: Math.round(20/3), y: 4, width: 2, height: 4, left: Math.round(4/3), top: 0, offsetleft: 0, offsettop: Math.round(9/2) };
        var expect3 = { x:5, y:3, width: 5, height: 2, left: 0, top: Math.round(4/3), offsetleft: 0, offsettop: 0 };

        assert_eq(catblock._fit(pic1, t1), expect1);
        assert_eq(catblock._fit(pic1, t2), expect2);
        assert_eq(catblock._fit(pic1, t3), expect3);

        pic = { x: 1024, y: 768, left: 100, top: 100, right: 100, bot: 100 };
        var t4 = { x: 300, y: 250 };
        var expect4 = { x: 333, y: 250, width: 300, height: 250, left: 17, top:0, offsetleft: 0, offsettop: 0 };
        assert_eq(catblock._fit(pic, t4), expect4);

        pic = { x: 1024, y: 768, left: 100, top: 300, right: 100, bot: 0 };
        var t4 = { x: 512, y: 100 };
        var expect4 = { x: 219, y: 164, width: 219, height: 100, offsettop: 0, left: 0, top: 64, offsetleft: 147 };
        assert_eq(catblock._fit(pic, t4), expect4);
    }

    console.log("Running tests");
    test_catblock();

})();