var path = require("path");
var buster = require("buster-core");
buster.cli = require("../cli");
buster.args = require("buster-args");

function loadConfigModule(config) {
    var files = [].slice.call(arguments, 1);
    var loaded;

    for (var i = 0, l = files.length; i < l; ++i) {
        if (!files[i]) continue;

        try {
            loaded = config.loadModule(files[i], process.cwd());
            if (loaded) return files[i];
        } catch (e) {
            e.message = "Error loading configuration " + files[i] + "\n" + e.message;
            throw e;
        }
    }
}


var colorOpt = {
    "dim": { color: true, bright: false },
    "bright": { color: true, bright: true }
};

module.exports = buster.extend(buster.create(buster.cli), {
    missionStatement: "Run Buster.JS tests on node, in browsers, or both",
    usage: "buster-test [options] [filters]",
    description: 
        "\nOptionally provide a test name filter to run a selection of tests:\n" +
        "`buster-test configuration` runs all contexts/tests with the word\n" +
        "'configuration' in their name.",

    onRun: function () {
        var options = buster.extend({
            reporter: this.reporter.value(),
            filters: this.filters.value(),
            cwd: process.cwd()
        }, colorOpt[this.color.value()]);

        this.onConfig(function (err, config) {
            if (err) {
                this.logger.e(err.message);
                if (err.stack) this.logger.e(err.stack);
            } else {
                this.logger.info("Running tests:", config.description);
                this.loadRunner(config.environment).run(config, options);
            }
        }.bind(this));
    },

    options: function () {
        this.config = this.opt("-c", "--config", "Test configuration file", {
            hasValue: true,
            validators: { "file": "-c/--config: ${1} is not a file" }
        });

        this.reporter = this.opt("-r", "--reporter", "Test output reporter", {
            defaultValue: "xUnitConsole"
        });

        this.color = this.opt("-C", "--color", "Output color scheme", {
            values: ["dim", "bright", "none"],
            defaultValue: "bright"
        });

        this.filters = this.args.createOperand();
        this.filters.greedy = true;
    },

    onConfig: function (callback) {
        var configOpt = this.config.value();
        var provided = configOpt && configOpt.path;
        var config = require("buster-client").configuration.create(), loaded;

        try {
            loaded = loadConfigModule(config, provided, "buster.js",
                                      "test/buster.js", "spec/buster.js");
        } catch (e) {
            return callback(e);
        }

        if (!loaded) {
            return callback({ message: this.config.signature + " not provided, and " +
                              "none of\n[buster.js, test/buster.js, " +
                              "spec/buster.js] exists" });
        }

        config.eachGroup(function (err, group) {
            if (err) err = { message: loaded + ": " + err.message };
            callback.call(this, err, group);
        }.bind(this));
    },

    loadRunner: function (env, config) {
        var runner = Object.create(require("./runners/" + env + "-runner"));
        runner.logger = this.logger;

        return runner;
    }
});
