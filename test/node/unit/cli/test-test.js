var helper = require("../../test-helper");
var buster = require("buster");
assert = buster.assert;
buster.testCli = helper.require("cli/test");

buster.testCase("Test client cli", {
    setUp: helper.cliTestSetUp(buster.testCli),

    "run": {
        "should print help message": function () {
            this.cli.run(["--help"]);

            assert.match(this.stdout, "Run Buster.JS tests on node, in browsers");
            assert.match(this.stdout, "--help");
        }
    }
});
