var path = require("path");
var buster = require("buster-core");
buster.args = require("buster-args");
buster.cli = require("../cli");
buster.require("client");

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

module.exports = buster.extend(buster.create(buster.cli), {
    missionStatement: "Run Buster.JS tests on node, in browsers, or both",

    onRun: function () {
        var options = {
            reporter: this.reporter.value()
        };

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
        var args = Object.create(buster.args);
        this.config = args.createOption("-c", "--config");
        this.config.hasValue = true;
        this.config.help = "Test configuration file";
        var err = this.config.signature + ": ${1} is not a file";
        this.config.addValidator(buster.args.validators.file(err, err));

        this.reporter = args.createOption("-r", "--reporter");
        this.reporter.hasValue = true;
        this.reporter.help = "Test output reporter/formatter";
        this.reporter.defaultValue = "xUnitConsole";

        return args;
    },

    onConfig: function (callback) {
        var configOpt = this.config.value();
        var provided = configOpt && configOpt.path;
        var config = buster.configuration.create(), loaded;

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

        config.eachGroup(function (group) {
            callback.call(this, null, group);
        }.bind(this));
    },

    loadRunner: function (env, config) {
        var runner = Object.create(require("./runners/" + env + "-runner"));
        runner.logger = this.logger;

        return runner;
    }
});
