var helper = require("../test-helper");
var buster = require("buster");
var configHelper = helper.require("config");
var testConfig = require("buster-configuration");
var assert = buster.assert;
var refute = buster.refute;
var version = testConfig.VERSION;

buster.testCase("Test client configuration", {
    setUp: function () {
        this.config = testConfig.create();
        this.config.addGroup("Client tests", {});
        this.config.addGroup("Server tests", { environment: "node", load: ["something.js"] });
    },

    tearDown: helper.clientTearDown,

    "should preload session configuration with library": function (done) {
        extendConfigGroup(this.config, "browser", function (configGroup) {
            var res = configGroup.resources;

            assert.isObject(res["/buster/buster-core.js"]);
            assert.isObject(res["/buster/buster-event-emitter.js"]);
            assert.isObject(res["/buster/buster-evented-logger.js"]);
            assert.isObject(res["/buster/buster-assertions.js"]);
            assert.isObject(res["/buster/buster-assertions/expect.js"]);
            assert.isObject(res["/buster/buster-format.js"]);
            assert.isObject(res["/buster/buster-promise.js"]);
            assert.isObject(res["/buster/sinon.js"]);
            assert.isObject(res["/buster/sinon/spy.js"]);
            assert.isObject(res["/buster/sinon/stub.js"]);
            assert.isObject(res["/buster/sinon/mock.js"]);
            assert.isObject(res["/buster/sinon/collection.js"]);
            assert.isObject(res["/buster/sinon/sandbox.js"]);
            assert.isObject(res["/buster/sinon/test.js"]);
            assert.isObject(res["/buster/sinon/test_case.js"]);
            assert.isObject(res["/buster/sinon/assert.js"]);
            assert.isObject(res["/buster/sinon/util/fake_xml_http_request.js"]);
            assert.isObject(res["/buster/sinon/util/fake_timers.js"]);
            assert.isObject(res["/buster/sinon/util/fake_server.js"]);
            assert.isObject(res["/buster/sinon/util/fake_server_with_clock.js"]);
            assert.isObject(res["/buster/buster-test/spec.js"]);
            assert.isObject(res["/buster/buster-test/test-case.js"]);
            assert.isObject(res["/buster/buster-test/test-context-filter.js"]);
            assert.isObject(res["/buster/buster-test/test-runner.js"]);
            assert.isObject(res["/buster/buster-test/reporters/json-proxy.js"]);
            assert.isObject(res["/buster/sinon-buster.js"]);
            assert.isObject(res["/buster/bundle-" + version + ".js"]);
            assert.isObject(res["/buster/sinon/util/timers_ie.js"]);
            assert.isObject(res["/buster/sinon/util/xhr_ie.js"]);
            assert.isObject(res["/buster/buster/buster-wiring.js"]);
            assert.isObject(res["/buster/wiring.js"]);

            assert.equals(configGroup.load, [
                "/buster/bundle-" + version + ".js",
                "/buster/compat-" + version + ".js",
                "/buster/wiring.js"]);

            done();
        });
    }
});

function extendConfigGroup(config, env, callback) {
    config.filterEnv(env).groups[0].resolve().then(function (group) {
        configHelper.extendConfigurationGroupWithWiring(group);

        group.resourceSet.getReadOnly(function (err, conf) {
            callback(conf);
        });
    });
}
