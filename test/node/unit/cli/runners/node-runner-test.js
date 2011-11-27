var helper = require("../../../test-helper");
var buster = require("buster");
buster.autoRun = require("buster-test").autoRun;
buster.testCase = require("buster-test").testCase;
buster.spec = require("buster-test").spec;
assert = buster.assert;
var run = helper.runTest;
var nodeRunner = helper.require("cli/runners/node-runner");

buster.testCase("Node runner", {
    setUp: function () {
        this.stub(buster, "autoRun");
        this.options = {};
    },

    "should use buster.autoRun to run tests": function () {
        nodeRunner.run({ absoluteLoadEntries: [] }, this.options);

        assert.calledOnce(buster.autoRun);
        assert.calledWith(buster.autoRun, this.options);
    },

    "should register listener for created test cases": function () {
        var runner = function () {};
        buster.autoRun.returns(runner);
        nodeRunner.run({ absoluteLoadEntries: [] }, this.options);

        assert.equals(buster.testCase.onCreate, runner);
        assert.equals(buster.spec.describe.onCreate, runner);
    },

    "should call done callback when complete": function () {
        var callback = this.spy();
        buster.autoRun.yields();
        nodeRunner.run({ absoluteLoadEntries: [] }, {}, callback);

        assert.calledOnce(callback);
    }
});
