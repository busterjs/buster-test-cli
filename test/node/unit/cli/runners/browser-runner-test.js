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
        this.stub(busterConfigExt, "extendConfigurationGroup");
        this.options = { server: "http://127.0.0.1:1200" };
    },

    "should create client for configured location": function () {
        browserRunner.run({ load: [] }, this.options);

        assert.calledWith(busterClient.create, "1200", "127.0.0.1");
    },

    "should extend configuration": function () {
        var config = { id: 42 };
        browserRunner.run(config, this.options);

        assert.calledOnce(busterConfigExt.extendConfigurationGroup);
        assert.calledWith(busterConfigExt.extendConfigurationGroup, config);
    },

    "should create session using provided session configuration": function () {
        browserRunner.run({ sessionConfig: { id: 41 } }, this.options);

        assert.calledOnce(this.client.createSession);
        assert.calledWith(this.client.createSession, { id: 41 });
    },

    "should session should be run with runSession": function () {
        this.stub(browserRunner, "runSession");
        browserRunner.run({ sessionConfig: { id: 41 } }, this.options);

        this.sessionPromise.resolve({ id: 47 });

        assert.calledOnce(browserRunner.runSession);
        assert.calledOn(browserRunner.runSession, browserRunner);
        assert.calledWith(browserRunner.runSession, { id: 47 });
    },

    "error handling": {
        setUp: function () {
            this.runner = Object.create(browserRunner);
            var self = this;
            this.stderr = "";

            this.runner.logger = {
                e: function (arg) {
                    self.stderr += arg + "\n";
                }
            };
        },

        "should print session creation error to stderr": function () {
            this.runner.run({ sessionConfig: { id: 41 } }, this.options);
            this.sessionPromise.reject({ id: 47 });
            
            assert.match(this.stderr, "Failed creating session");
        },

        // TODO: The error is actually asynchronously thrown from within buster-client
        "should print understandable error if server cannot be reached": function () {
            busterClient.create.throws(new Error("ECONNREFUSED, Connection refused"));
            this.runner.run({ sessionConfig: { id: 41 } }, this.options);

            assert.match(this.stderr, "Unable to connect to server");
            assert.match(this.stderr, "http://127.0.0.1:1200");
            assert.match(this.stderr, "Please make sure that buster-server is running");
        }
    }
});
