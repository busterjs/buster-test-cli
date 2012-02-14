var helper = require("../../../test-helper");
var buster = require("buster");
buster.autoRun = require("buster-test").autoRun;
buster.testCase = require("buster-test").testCase;
buster.spec = require("buster-test").spec;
assert = buster.assert;
var run = helper.runTest;
var nodeRunner = helper.require("cli/runners/node-runner");
var stdioLogger = require("buster-stdio-logger");
var when = require("when");

buster.testCase("Node runner", {
    setUp: function () {
        this.stub(buster, "autoRun");
        this.options = {};
        this.config = when.defer();
        this.analyzer = when.defer();
        this.group = buster.extend(buster.eventEmitter.create(), {
            resolve: this.stub().returns(this.config.promise),
            runExtensionHook: this.stub()
        });
        var loadPaths = this.loadPaths = [];
        this.resourceSet = {
            loadPath: {
                paths: function () { return loadPaths; }
            }
        };
        this.runner = Object.create(nodeRunner);
        this.stdout = "";
        this.stderr = "";
        var self = this;
        this.runner.logger = stdioLogger(
            { write: function (msg) { self.stdout += msg; } },
            { write: function (msg) { self.stderr += msg; } }
        );
    },

    "resolves config": function () {
        this.runner.run(this.group, this.options);

        assert.calledOnce(this.group.resolve);
    },

    "does not autoRun until config is resolved": function () {
        this.runner.run(this.group, this.options);

        refute.called(buster.autoRun);
    },

    "uses buster.autoRun to run tests": function () {
        this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
        this.analyzer.resolver.resolve();
        this.config.resolver.resolve(this.resourceSet);

        this.runner.run(this.group, this.options);

        assert.calledOnce(buster.autoRun);
        assert.calledWith(buster.autoRun, this.options);
    },

    "registers listener for created test cases": function () {
        this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
        this.analyzer.resolver.resolve();
        this.config.resolver.resolve(this.resourceSet);
        var runner = function () {};
        buster.autoRun.returns(runner);
        this.runner.run(this.group, this.options);

        assert.equals(buster.testCase.onCreate, runner);
        assert.equals(buster.spec.describe.onCreate, runner);
    },

    "calls done callback when complete": function () {
        this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
        this.analyzer.resolver.resolve();
        this.config.resolver.resolve(this.resourceSet);
        var callback = this.spy();
        buster.autoRun.yields();
        this.runner.run(this.group, {}, callback);

        assert.calledOnce(callback);
    },

    "requires absolute paths": function () {
        this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
        this.analyzer.resolver.resolve();
        var promise = { then: this.stub() };
        this.group.resolve.returns(promise);
        this.resourceSet.rootPath = "/here";
        this.loadPaths.push("hey.js");
        this.runner.run(this.group, {});

        try {
            promise.then.yield(this.resourceSet);
            throw new Error("Didn't fail");
        } catch (e) {
            assert.match(this.stderr, "/here/hey.js");
        }
    },

    "logs load errors": function () {
        this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
        this.analyzer.resolver.resolve();
        var promise = { then: this.stub() };
        this.group.resolve.returns(promise);
        this.runner.run(this.group, {});

        try {
            promise.then.yield({
                loadPath: {
                    paths: this.stub().throws("Error", "Ay caramba")
                }
            });
            throw new Error("Didn't fail");
        } catch (e) {
            assert.match(this.stderr, "Ay caramba");
        }
    },

    "logs config resolution errors": function () {
        this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
        this.analyzer.resolver.resolve();
        this.config.resolver.reject({ message: "Oh noes" });
        this.runner.run(this.group, {});

        assert.match(this.stderr, "Oh noes");
    },

    "runs beforeRun extension hook": function () {
        this.runner.run(this.group, {});

        assert.calledOnceWith(this.group.runExtensionHook, "beforeRun", this.group);
    },

    "processes all resource sets": function () {
        this.stub(this.group, "on");

        this.runner.run(this.group, {});
        assert.equals(this.group.on.callCount, 4);

        var process = this.stub().returns({ then: function () {} });
        this.group.on.args[0][1]({ process: process });
        assert.calledOnce(process);
    },

    "aborts run if analyzer fails": function (done) {
        this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
        this.analyzer.resolver.reject();
        this.config.resolver.resolve({});

        nodeRunner.run(this.group, {}, done(function () {
            refute.called(buster.autoRun);
        }));
    }
});
