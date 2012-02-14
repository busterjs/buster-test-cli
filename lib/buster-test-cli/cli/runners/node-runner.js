var B = require("buster-core");
var test = require("buster-test");
B.autoRun = test.autoRun;
B.testCase = test.testCase;
B.spec = test.spec;
var path = require("path");
var beforeRun = require("./before-run");

module.exports = {
    run: function (config, options, done) {
        this.beforeRunHook(config, options, function () {});

        config.resolve().then(function (rs) {
            try {
                var runner = B.autoRun(options, done);
                B.testCase.onCreate = runner;
                B.spec.describe.onCreate = runner;

                var fullPath = B.partial(path.join, rs.rootPath);
                rs.loadPath.paths().map(fullPath).forEach(require);
            } catch (e) {
                this.logger.e(e.stack);
            }
        }.bind(this), function (err) {
            this.logger.e(err.message);
        }.bind(this));
    },

    beforeRunHook: function (config, options, onError) {
        var hook = beforeRun.create(config, this.logger, options);
        hook.beforeRunHook(onError);
        ["libs", "sources", "testLibs", "tests"].forEach(function (section) {
            config.on("load:" + section, function (resourceSet) {
                resourceSet.process();
            });
        });
    }
};
