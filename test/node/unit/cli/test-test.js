var helper = require("../../test-helper");
var buster = require("buster");
assert = buster.assert;
buster.testCli = helper.require("cli/test");
var run = helper.runTest;

buster.testCase("Test client cli", {
    setUp: helper.cliTestSetUp(buster.testCli),
    tearDown: helper.clientTearDown,

    "run": {
        "should print help message": run(["--help"], function () {
            assert.match(this.stdout, "Run Buster.JS tests on node, in browsers");
            assert.match(this.stdout, "--help");
        }),

        "should fail if config does not exist": run(["-c", "file.js"], function () {
            assert.match(this.stderr, "-c/--config: file.js is not a file");
        }),

        "should fail if config is a directory": function (done) {
            helper.mkdir("buster");

            this.cli.run(["-c", "buster"], function () {
                assert.match(this.stderr, "-c/--config: buster is not a file");
                done();
            }.bind(this));
        },

        "should fail if default config does not exist": run([], function () {
            assert.match(this.stderr, "-c/--config not provided, and none of\n" +
                         "[buster.js, test/buster.js, spec/buster.js] exists");
        })
    }
});
