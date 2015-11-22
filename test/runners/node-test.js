var buster = require("buster-node");
var assert = buster.assert;
var refute = buster.refute;
var test = require("buster-test");
var nodeRunner = require("../../lib/runners/node");
var testRun = nodeRunner.testRun;
var streamLogger = require("stream-logger");
var when = require("when");
var fs = require("fs");
var cliHelper = require("buster-cli/test/test-helper");
var bane = require("bane");
var path = require("path");

function createNodeRunner() {
    var stdout = cliHelper.writableStream("stdout");
    var stderr = cliHelper.writableStream("stderr");
    return nodeRunner.create({
        logger: streamLogger(stdout, stderr)
    });
}

function resourceSet(tc, rootPath, loadPaths) {
    return {
        rootPath: rootPath || "/",
        loadPath: { paths: tc.stub().returns(loadPaths || []) },
        process: tc.stub().returns({
            then: tc.stub().yields()
        })
    };
}

function fakeConfig(tc) {
    var rs = resourceSet(tc, "/here", ["hey.js"]);
    return bane.createEventEmitter({
        resolve: tc.stub().returns(when(rs)),
        runExtensionHook: tc.stub()
    });
}

buster.testCase("Node runner", {
    setUp: function () {
        this.runner = createNodeRunner();
        this.stubBeforeRunHook = function () {
            var deferred = when.defer();
            this.stub(testRun, "beforeRunHook").returns(deferred.promise);
            return deferred.resolver;
        };
    },

    "//run configuration": {
        "captures console if configured to": function () {
            this.stub(buster, "captureConsole");
            this.runner.run(fakeConfig(this), { captureConsole: true });
            assert.calledOnce(buster.captureConsole);
        },

        "does not capture console if not configured to": function () {
            this.stub(buster, "captureConsole");
            this.runner.run(fakeConfig(this), { captureConsole: false });
            refute.called(buster.captureConsole);
        },

        "does not capture console by default": function () {
            this.stub(buster, "captureConsole");
            this.runner.run(fakeConfig(this), {});
            refute.called(buster.captureConsole);
        }
    },

    "config resolution": {
        "resolves config": function () {
            var config = fakeConfig(this);
            this.runner.run(config, {});
            assert.calledOnce(config.resolve);
        },

        "does not autoRun until config is resolved": function () {
            this.stub(test, "autoRun");
            var config = fakeConfig(this);
            config.resolve.returns(when.defer());
            this.runner.run(config, {});

            refute.called(test.autoRun);
        },

        "does not autoRun if before run hook is not processed": function () {
            this.stub(test, "autoRun");
            var config = fakeConfig(this);
            this.runner.run(config, {});
            refute.called(test.autoRun);
        },

        "autoRuns when config and beforeRunHook is resolved": function (done) {
            this.stubBeforeRunHook().resolve([]);
            this.stub(test, "autoRun");
            var config = fakeConfig(this);
            var deferred = when.defer();
            config.resolve.returns(deferred.promise);

            this.runner.run(config, {}, function () {
                assert.called(test.autoRun);
                done();
            });
            var rs = resourceSet(this, "/here", ["hey.js"]);
            deferred.resolve(rs);
        },

        "yields config resolution error to done callback": function (done) {
            // If the configuration fails to load, the beforeRunHook
            // will never resolve, as it waits for all the load:???
            // events (one or more of which will not be emitted when
            // the configuration fails loading the resource set)
            var config = fakeConfig(this);
            var deferred = when.defer();
            config.resolve.returns(deferred.promise);

            this.runner.run(config, {}, function (err) {
                assert.equals(err.code, 70);
                assert.equals(err.message, msg);
                done();
            });

            var msg = "Unknown configuration option 'foo'";
            deferred.reject(new Error(msg));
        }
    },

    "before run hook": {

        "rejects if extension hooks throws": function () {
            var config = fakeConfig(this);
            config.runExtensionHook.throws();
            this.runner.run(config, {}, function (err) {
                assert.equals(err.code, 70);
            });
        },

        "runs beforeRun extension hook": function () {
            var config = fakeConfig(this);
            this.runner.run(config, {});

            assert.calledOnce(config.runExtensionHook, "beforeRun");
        },

        "runs beforeRun before config.resolve": function () {
            var config = fakeConfig(this);
            this.runner.run(config, {});

            assert.callOrder(config.runExtensionHook, config.resolve);
        }
    },

    "testRun extension hook": {
        "fires with test runner": function (done) {
            this.stubBeforeRunHook().resolve([]);
            this.stub(test, "autoRun");
            var config = fakeConfig(this);
            this.runner.run(config, {}, function () {
                test.autoRun.yieldTo("start", { id: 42 });
                assert.calledWith(config.runExtensionHook, "testRun", { id: 42 });
                done();
            });
        }
    },

    "running tests": {
        setUp: function () {
            this.stub(test, "autoRun");
            this.autoRunner = this.spy();
            test.autoRun.returns(this.autoRunner);
            this.config = fakeConfig(this);
            this.contextListeners = test.testContext.listeners;
            delete test.testContext.listeners;
            this.stub(fs, "writeFileSync");
            cliHelper.cdFixtures();
        },

        tearDown: function () {
            test.testContext.listeners = this.contextListeners;
        },

        "registers listener for created test cases": function (done) {
            this.stubBeforeRunHook().resolve([]);
            this.runner.run(this.config, {}, function () {
                test.testContext.emit("create", { id: 42 });
                assert.calledOnce(this.autoRunner, { id: 42 });
                done();
            }.bind(this));
        },

        "calls done callback when complete": function (done) {
            this.stubBeforeRunHook().resolve([]);
            test.autoRun.yieldsTo("end", { ok: true, tests: 42 });
            this.runner.run(this.config, {}, function (err, res) {
                assert.isNull(err);
                assert.equals(res, { ok: true, tests: 42 });
                done();
            });
        },

        "requires absolute paths": function (done) {
            this.stubBeforeRunHook().resolve([]);

            this.runner.run(this.config, {}, done(function (err) {
                assert.match(err, {
                    message: "Failed requiring " + path.join("/here/hey.js"),
                    code: 65
                });
            }));
        },

        "processes all resource sets": function (done) {
            var rs = resourceSet(this);

            this.runner.run(this.config, {}, done(function () {
                assert.equals(rs.process.callCount, 4);
            }.bind(this)));

            this.config.emit("load:libs", rs);
            this.config.emit("load:sources", rs);
            this.config.emit("load:testHelpers", rs);
            this.config.emit("load:tests", rs);
        },

        "processes resource sets with existing manifest": function () {
            this.stub(fs, "readFile").yields(null,
                '{"/somewhere.js": ["123"]}');

            this.runner.run(this.config, {});
            var rs = { process: this.stub().returns({ then: function () {} }) };
            this.config.emit("load:libs", rs);

            assert.calledWith(rs.process, { "/somewhere.js": ["123"] });
        },

        "writes manifest when successful": function (done) {
            this.stubBeforeRunHook().resolve([]);
            this.runner.run(this.config, {}, function () {
                assert.calledOnce(fs.writeFileSync);
                done();
            });
        },

        "does not write manifest when beforeRunHook fails": function (done) {
            var beforeResolver = this.stubBeforeRunHook();
            this.runner.run(this.config, {}, function () {
                refute.called(fs.writeFileSync);
                done();
            });

            beforeResolver.reject(new Error("Oh no"));
        },

        "does not write manifest when aborted": function (done) {
            var beforeResolver = this.stubBeforeRunHook();
            var run = this.runner.run(this.config, {}, function () {
                refute.called(fs.writeFileSync);
                done();
            });

            run.abort({ message: "Oh snap" });
            beforeResolver.resolve([{}]);
        },

        "does not run tests when aborted": function (done) {
            var beforeResolver = this.stubBeforeRunHook();
            var run = this.runner.run(this.config, {}, function () {
                refute.called(test.autoRun);
                done();
            });

            run.abort({ message: "Oh snap" });
            beforeResolver.resolve([{}]);
        },

        "call done when aborted": function (done) {
            var beforeResolver = this.stubBeforeRunHook();
            var run = this.runner.run(this.config, {}, function (err) {
                assert.equals(err, { code: 70, message: "Oh snap" });
                done();
            });

            run.abort({ message: "Oh snap" });
            beforeResolver.resolve([{}]);
        },

        "does not run tests in case of no matching test files": function (done) {
            var beforeResolver = this.stubBeforeRunHook();
            this.config.resolve.returns(when(resourceSet(this, "/here", [])));
            this.runner.run(this.config, {}, function () {
                refute.called(test.autoRun);
                done();
            });

            beforeResolver.resolve([{}]);
        },

        "call done in case of no matching test files": function (done) {
            var beforeResolver = this.stubBeforeRunHook();
            this.config.resolve.returns(when(resourceSet(this, "/here", [])));
            this.runner.run(this.config, {}, function (err) {
                refute.defined(err);
                done();
            });

            beforeResolver.resolve([{}]);
        }

    }
});
