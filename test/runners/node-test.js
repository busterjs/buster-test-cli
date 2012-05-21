var buster = require("buster");
var bTest = require("buster-test");
var nodeRunner = require("../../lib/runners/node");
var stdioLogger = require("buster-stdio-logger");
var when = require("when");
var fs = require("fs");
var beforeRun = require("../../lib/before-run-hook");
var cliHelper = require("buster-cli/lib/test-helper");

function fakeConfig(tc) {
    return buster.extend(buster.eventEmitter.create(), {
        resolve: tc.stub(),
        runExtensionHook: tc.stub()
    });
}

function createNodeRunner() {
    var stdout = cliHelper.writableStream("stdout");
    var stderr = cliHelper.writableStream("stderr");
    return nodeRunner.create({ logger: stdioLogger(stdout, stderr) });
}

buster.testCase("Node runner", {
    setUp: function () {
        this.stub(process, "exit");
        this.runner = createNodeRunner();
    },

    "run configuration": {
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
            this.stub(bTest, "autoRun");
            this.runner.run(fakeConfig(this), {});
            refute.called(bTest.autoRun);
        }
    },

    "before run hook": {
        "exits if beforeRunHook fails": function () {
            var config = fakeConfig(this);
            config.runExtensionHook.throws();
            this.runner.run(config, {});

            assert.calledOnceWith(process.exit, 70);
        }
    },

    "test running": {
        "uses autoRun": function () {
            this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
            this.analyzer.resolver.resolve();
            this.config.resolver.resolve(this.resourceSet);

            this.runner.run(this.group, this.options);

            assert.calledOnce(bTest.autoRun);
            assert.calledWith(bTest.autoRun, this.options);
        }
    },

    // "fires testRun extension hook with test runner": function () {
    //     this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
    //     this.analyzer.resolver.resolve();
    //     this.config.resolver.resolve(this.resourceSet);

    //     this.runner.run(this.group, this.options);
    //     bTest.autoRun.yieldTo("start", { id: 42 });

    //     assert.calledOnceWith(this.group.runExtensionHook, "testRun", { id: 42 });
    // },

    // "registers listener for created test cases": function () {
    //     this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
    //     this.analyzer.resolver.resolve();
    //     this.config.resolver.resolve(this.resourceSet);
    //     var runner = this.spy();
    //     bTest.autoRun.returns(runner);
    //     this.runner.run(this.group, this.options);

    //     bTest.testContext.emit("create", { id: 42 });

    //     assert.calledOnce(runner, { id: 42 });
    // },

    // "calls done callback when complete": function () {
    //     this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
    //     this.analyzer.resolver.resolve();
    //     this.config.resolver.resolve(this.resourceSet);
    //     var callback = this.spy();
    //     bTest.autoRun.yieldsTo("end", { ok: true, tests: 42 });
    //     this.runner.run(this.group, {}, callback);

    //     assert.calledOnce(callback);
    //     assert.calledWith(callback, null, { ok: true, tests: 42 });
    // },

    // "requires absolute paths": function () {
    //     this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
    //     this.analyzer.resolver.resolve();
    //     var promise = { then: this.stub() };
    //     this.group.resolve.returns(promise);
    //     this.resourceSet.rootPath = "/here";
    //     this.loadPaths.push("hey.js");
    //     this.runner.run(this.group, {});

    //     try {
    //         promise.then.yield(this.resourceSet);
    //         throw new Error("Didn't fail");
    //     } catch (e) {
    //         assert.match(this.stderr, "/here/hey.js");
    //     }
    // },

    // "calls callback with error if using relative paths": function () {
    //     this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
    //     this.analyzer.resolver.resolve();
    //     var promise = { then: this.stub() };
    //     this.group.resolve.returns(promise);
    //     this.resourceSet.rootPath = "/here";
    //     this.loadPaths.push("hey.js");
    //     var callback = this.spy();
    //     this.runner.run(this.group, {}, callback);

    //     try {
    //         promise.then.yield(this.resourceSet);
    //     } catch (e) {
    //         assert.match(this.stderr, "/here/hey.js");
    //     }

    //     assert.calledOnce(callback);
    //     assert.match(callback.args[0][0], {
    //         code: 65
    //     });
    // },

    // "logs load errors": function () {
    //     this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
    //     this.analyzer.resolver.resolve();
    //     var promise = { then: this.stub() };
    //     this.group.resolve.returns(promise);
    //     this.runner.run(this.group, {});

    //     try {
    //         promise.then.yield({
    //             loadPath: {
    //                 paths: this.stub().throws("Error", "Ay caramba")
    //             }
    //         });
    //         throw new Error("Didn't fail");
    //     } catch (e) {
    //         assert.match(this.stderr, "Ay caramba");
    //     }
    // },

    // "logs config resolution errors": function () {
    //     this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
    //     this.analyzer.resolver.resolve();
    //     this.config.resolver.reject({ message: "Oh noes" });
    //     this.runner.run(this.group, {});

    //     assert.match(this.stderr, "Oh noes");
    // },

    // "runs beforeRun extension hook": function () {
    //     this.runner.run(this.group, {});

    //     assert.calledOnceWith(this.group.runExtensionHook, "beforeRun", this.group);
    // },

    // "processes all resource sets": function () {
    //     this.stub(this.group, "on");

    //     this.runner.run(this.group, {});
    //     assert.equals(this.group.on.callCount, 4);

    //     var process = this.stub().returns({ then: function () {} });
    //     this.group.on.args[0][1]({ process: process });
    //     assert.calledOnce(process);
    // },

    // "processes resource sets with existing manifest": function () {
    //     this.stub(fs, "readFileSync").returns('{"/somewhere.js": ["1234"]}');
    //     this.stub(this.group, "on");

    //     this.runner.run(this.group, {});
    //     assert.equals(this.group.on.callCount, 4);

    //     var process = this.stub().returns({ then: function () {} });
    //     this.group.on.args[0][1]({ process: process });
    //     assert.calledWith(process, { "/somewhere.js": ["1234"] });
    // },

    // "writes manifest when successful": function () {
    //     this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
    //     this.analyzer.resolver.resolve();
    //     this.config.resolver.resolve(this.resourceSet);

    //     this.runner.run(this.group, this.options);

    //     assert.calledOnce(fs.writeFileSync);
    // },

    // "aborts run if analyzer fails": function (done) {
    //     this.stub(beforeRun, "beforeRunHook");
    //     this.config.resolver.resolve({});

    //     this.runner.run(this.group, {}, done(function (err) {
    //         refute.called(bTest.autoRun);
    //         assert.match(err, {
    //             code: 70
    //         });
    //     }));

    //     beforeRun.beforeRunHook.yield({});
    // },

    // "does not write manifest if analyzer fails": function (done) {
    //     this.stub(nodeRunner, "beforeRunHook").returns(this.analyzer.promise);
    //     this.analyzer.resolver.reject();
    //     this.config.resolver.resolve({});

    //     this.runner.run(this.group, {}, done(function () {
    //         refute.called(fs.writeFileSync);
    //     }));
    // },
});
