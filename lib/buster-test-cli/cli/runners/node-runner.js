var buster = require("buster-core");
buster.require("test");
var glob = require("glob");
var path = require("path");

module.exports = {
    run: function (config, options) {
        buster.test.autoRun();
        process.env.BUSTER_REPORTER = options.reporter;

        config.load.forEach(function (file) {
            require(path.resolve(config.rootPath, file));
        });
    }
};
