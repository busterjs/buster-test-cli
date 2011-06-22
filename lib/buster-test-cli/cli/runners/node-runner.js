var buster = require("buster-core");
buster.require("test");
var glob = require("glob");
var path = require("path");

module.exports = {
    run: function (config, options) {
        // TODO: Use buster.test.autoRun
        buster.test.autoRun();
        process.env.BUSTER_REPORTER = options.reporter;

        (config.tests || []).forEach(function (test) {
            glob.glob(test, function (err, matches) {
                matches.forEach(function (file) {
                    require(path.resolve(process.cwd(), file));
                });
            });
        });
    }
};
