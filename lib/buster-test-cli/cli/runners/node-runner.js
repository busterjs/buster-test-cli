var buster = require("buster-core");
var test = require("buster-test");
buster.autoRun = test.autoRun;
buster.testCase = test.testCase;
buster.spec = test.spec;
var path = require("path");

module.exports = {
    run: function (config, options) {
        var runner = buster.autoRun(options);
        buster.testCase.onCreate = runner;
        buster.spec.describe.onCreate = runner;

        config.absoluteLoadEntries.forEach(function (file) {
            require(file);
        });
    }
};
