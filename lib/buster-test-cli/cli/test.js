var path = require("path");
var buster = require("buster-core");
var Q = require("q");
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
    get help() {
        var testReporters = require("buster-test").reporters
        var reporters = Object.keys(testReporters).filter(function (r) {
            return typeof testReporters[r] == "object";
        });

        return {
            "reporters": "Buster.JS ships with a set of built-in reporters. These can be used by\n" +
"providing the name to the -r/--reporter option:\n" +
"buster-test -r xUnitConsole\n\n" +
"The xUnitConsole reporter is the default reporter. Built-in reporters\n" +
"include:\n" + reporters.join("\n") + "\n\n" +
"Custom reporters\n" +
"Buster.JS can use custom reporters that are reachable through the node\n" +
"module system. Assume you have a reporter that looks like:\n\n" +
"module.exports = {\n" +
"    create: function (options) {\n" +
"        // ...\n" +
"    },\n\n" +
"    listen: function (runner) {\n" +
"        // ...\n" +
"    },\n\n" +
"    // ...\n" +
"};\n\n" +
"When this reporter is available on the node load path, say in the\n" +
"my-reporter module, you can use it the following way:\n" +
"`buster-test -r my-reporter`\n\n" +
"If your module is not the main export from the module, you can provide the\n" +
"'path' to the correct object using the following syntax: \n" +
"`buster-test -r my-reporters#console.fancy`\n\n" +
"This will cause Buster to load the `my-reporters' module, and try to use\n" +
"the `console.fancy' object exported from it.\n\n" +
"The BUSTER_REPORTER environment variable\n" +
"If you want a different reporter, but don't want to specify it for each\n" +
"run, you can specify the BUSTER_REPORTER environment variable in e.g. ,\n" +
".bashrc and Buster will use this reporter as long as another one is not\n" +
"specified with the -r option.\n\n" +
"For information on implementing custom reporters, refer to the online docs\n" +
"at http://busterjs.org/docs/buster-test/reporters/"
        };
    },

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
            defaultValue: "xUnitConsole",
            validators: { "reporter": "No such reporter '${1}'" }
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

buster.args.validators.reporter = function (errMsg) {
    return function () {
        var deferred = Q.defer();

        try {
            require("buster-test").reporters.load(this.value());
            deferred.resolve();
        } catch (e) {
            deferred.reject(
                this.signature + ": " + errMsg.replace("${1}", this.value()) +
                    "\n" + e.message + "\nLearn more about reporters with " +
                    "`buster-test -h reporters`");
        }

        return deferred.promise;
    }
};
