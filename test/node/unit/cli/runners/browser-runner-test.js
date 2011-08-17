var helper = require("../../../test-helper");
var buster = require("buster");
var assert = buster.assert;
var browserRunner = helper.require("cli/runners/browser-runner");
var busterClient = require("buster-client").client;
var busterConfigExt = helper.require("config");
var busterPromise = require("buster-promise");

buster.testCase("Browser runner", {
    setUp: function () {
        this.sessionPromise = busterPromise.create();
        this.client = { createSession: this.stub().returns(this.sessionPromise) };
        this.stub(busterClient, "create").returns(this.client);
        this.stub(busterConfigExt, "extendConfiguration");
    },

    "should create client on default location": function () {
        browserRunner.run({ load: [] });

        assert.calledOnce(busterClient.create);
        assert.calledWith(busterClient.create, "1111", "localhost");
    },

    "should create client for configured location": function () {
        browserRunner.run({ load: [] }, { server: "http://127.0.0.1:1200" });

        assert.calledWith(busterClient.create, "1200", "127.0.0.1");
    },

    "should extend configuration": function () {
        var config = { id: 42 };
        browserRunner.run(config);

        assert.calledOnce(busterConfigExt.extendConfiguration);
        assert.calledWith(busterConfigExt.extendConfiguration, config);
    },

    "should create session using provided session configuration": function () {
        browserRunner.run({ sessionConfig: { id: 41 } });

        assert.calledOnce(this.client.createSession);
        assert.calledWith(this.client.createSession, { id: 41 });
    },

    "should session should be run with runSession": function () {
        this.stub(browserRunner, "runSession");
        browserRunner.run({ sessionConfig: { id: 41 } });

        this.sessionPromise.resolve({ id: 47 });

        assert.calledOnce(browserRunner.runSession);
        assert.calledOn(browserRunner.runSession, browserRunner);
        assert.calledWith(browserRunner.runSession, { id: 47 });
    },

    "should print session creation error to stderr": function () {
        var runner = Object.create(browserRunner);
        var stderr = "";
        runner.logger = { e: function (args) { stderr += args; } };

        runner.run({ sessionConfig: { id: 41 } });
        this.sessionPromise.reject({ id: 47 });

        assert.match(stderr, "Failed creating session");
    }
});
