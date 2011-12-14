var B = require("buster-core");
var test = require("buster-test");
B.autoRun = test.autoRun;
B.testCase = test.testCase;
B.spec = test.spec;
var path = require("path");

module.exports = {
    run: function (config, options, done) {
        var runner = B.autoRun(options, done);
        B.testCase.onCreate = runner;
        B.spec.describe.onCreate = runner;

        var load = config.resourceSet.load || [];
        load.map((B.partial(path.join, config.rootPath))).forEach(require);
    }
};
