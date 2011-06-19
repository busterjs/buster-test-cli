var buster = require("buster");
var assert = buster.assert;
buster.testCli = require("../../../lib/buster-test-cli");

buster.testCase("Module index", {
    "should have dynamic version getter": function () {
        assert.match(buster.testCli.VERSION, /^\d+\.\d+\.\d+$/);
    }
});
