var version = require("../buster-test-cli").VERSION;

module.exports = {
    extendConfiguration: function extendConfiguration(config) {
        var configs = config.configsFor("browser");

        for (var i = 0, l = configs.length; i < l; ++i) {
            this.extendConfigurationGroup(configs[i]);
        }
    },

    extendConfigurationGroup: function (config) {
        var paths = addFileResources(
            config, ["buster-core", "buster-core.js"],
            ["buster-core", "buster-event-emitter.js"],
            ["buster-evented-logger", "buster-evented-logger.js"],
            ["buster-assertions", "buster-assertions.js"],
            ["buster-assertions", "buster-assertions/that.js"],
            ["buster-assertions", "buster-assertions/assert-that.js"],
            ["buster-assertions", "buster-assertions/refute-that.js"],
            ["buster-format", "buster-format.js"],
            ["buster-promise", "buster-promise.js"],
            ["sinon", "sinon.js"],
            ["sinon", "sinon/spy.js"],
            ["sinon", "sinon/stub.js"],
            ["sinon", "sinon/mock.js"],
            ["sinon", "sinon/collection.js"],
            ["sinon", "sinon/sandbox.js"],
            ["sinon", "sinon/test.js"],
            ["sinon", "sinon/test_case.js"],
            ["sinon", "sinon/assert.js"],
            ["sinon", "sinon/util/fake_xml_http_request.js"],
            ["sinon", "sinon/util/fake_timers.js"],
            ["sinon", "sinon/util/fake_server.js"],
            ["sinon", "sinon/util/fake_server_with_clock.js"],
            ["buster-test", "buster-test/spec.js"],
            ["buster-test", "buster-test/test-case.js"],
            ["buster-test", "buster-test/test-context-filter.js"],
            ["buster-test", "buster-test/test-runner.js"],
            ["buster-test", "buster-test/reporters/json-proxy.js"],
            ["sinon-buster", "sinon-buster.js"]);

        var iePaths = addFileResources(config, ["sinon", "sinon/util/timers_ie.js"],
                                       ["sinon", "sinon/util/xhr_ie.js"]);

        config.sessionConfig.addFileAsResource(require.resolve("./browser/wiring.js"), {
            path: "/buster/wiring.js"
        });

        config.sessionConfig.load("/buster/bundle-" + version + "-" + Date.now() + ".js", {
            combine: paths.concat("/buster/wiring.js"),
            headers: noCacheHeaders
        });

        config.sessionConfig.load("/buster/compat-" + version + ".js", {
            combine: iePaths,
            headers: noCacheHeaders
        });

        return config;
    }
};

var noCacheHeaders = {
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Expires": "0"
};

function addFileResources(config) {
    var files = Array.prototype.slice.call(arguments, 1);
    var fileName, paths = [];

    for (var i = 0, l = files.length; i < l; ++i) {
        fileName = require.resolve(files[i][0] + "/lib/" + files[i][1]);

        config.sessionConfig.addFileAsResource(fileName, {
            path: "/buster/" + files[i][1]
        });

        paths.push("/buster/" + files[i][1]);
    }

    return paths;
}
