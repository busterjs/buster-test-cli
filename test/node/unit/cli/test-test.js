var helper = require("../../test-helper");
var buster = require("buster");
assert = buster.assert;
buster.testCli = helper.require("cli/test");
var run = helper.runTest;
var nodeRunner = helper.require("cli/runners/node-runner");

buster.testCase("Test client cli", {
    setUp: helper.cliTestSetUp(buster.testCli),
    tearDown: helper.clientTearDown,

    "help": {
        "should print help message": run(["--help"], function () {
            assert.match(this.stdout, "Run Buster.JS tests on node, in browsers");
            assert.match(this.stdout, "--help");
        })
    },

    "configuration": {
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
        }),

        "should fail if config contains errors": function (done) {
            helper.writeFile("buster2.js", "modul.exports");

            helper.run(this, ["-c", "buster2.js"], function () {
                assert.match(this.stderr, "Error loading configuration buster2.js");
                assert.match(this.stderr, "modul is not defined");
                assert.match(this.stderr, /\d+:\d+/);
                done();
            });
        }
    },

    "node runs": {
        setUp: function () {
            helper.writeFile("buster.js", "var config = module.exports;" +
                             "config.server = { environment: 'node' }");
            this.stub(nodeRunner, "run");
        },

        "should load node runner": function (done) {
            helper.run(this, [], function () {
                assert.calledOnce(nodeRunner.run);
                assert.notEquals(nodeRunner.run.thisValues[0], nodeRunner);
                done();
            });
        },

        "should provide runner with logger": function (done) {
            helper.run(this, [], function () {
                assert.equals(this.cli.logger, nodeRunner.run.thisValues[0].logger);
                done();
            });
        },

        "should run runner with config and options": function (done) {
            helper.run(this, [], function () {
                assert.match(nodeRunner.run.args[0][1], { reporter: "xUnitConsole" });
                assert.equals(nodeRunner.run.args[0][0].environment, "node");
                done();
            });
        }
    }
});
