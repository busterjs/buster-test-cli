var helper = require("../../test-helper");
var buster = require("buster");
var assert = buster.assert;
var refute = buster.refute;
buster.testCli = helper.require("cli/test");
var run = helper.runTest;
var nodeRunner = helper.require("cli/runners/node-runner");

buster.testCase("Test cli", {
    setUp: helper.cliTestSetUp(buster.testCli),
    tearDown: helper.clientTearDown,

    "help": {
        "should print help message": run(["--help"], function () {
            assert.match(this.stdout, "Run Buster.JS tests on node, in browsers");
            assert.match(this.stdout, "--help");
        }),

        "should fail if no such help topic": run(["--help", "bleh"], function () {
            assert.match(this.stderr, "No such help topic 'bleh'.");
            assert.match(this.stderr, "Try without a specific help topic, or one of");
            assert.match(this.stderr, "reporters");
        }),

        "should print specific topic help": run(["--help", "reporters"], function () {
            assert.match(this.stdout, "xml");
            assert.match(this.stdout, "bddConsole");
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
        },

        "//should fail gracefully if runner is missing": function () {}
    },

    "node runs": {
        setUp: function () {
            helper.writeFile("buster.js", "var config = module.exports;" +
                             "config.server = { environment: 'node' }");
            this.stub(nodeRunner, "run");
        },

        "should load node runner": function (done) {
            helper.run(this, [], function () {
                done(function () {
                    assert.calledOnce(nodeRunner.run);
                    refute.equals(nodeRunner.run.thisValues[0], nodeRunner);
                });
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
        },

        "should transfer filters to node runner": function (done) {
            helper.run(this, ["//should-"], function () {
                assert.equals(nodeRunner.run.args[0][1].filters, ["//should-"]);
                done();
            });
        },

        "should fail if reporter does not exist": function (done) {
            helper.run(this, ["-r", "bogus"], function () {
                assert.match(this.stderr, "No such reporter 'bogus'");
                done();
            });
        }
    }
});
