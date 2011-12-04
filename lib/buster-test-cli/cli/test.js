var fs = require("fs");
var path = require("path");
var buster = require("buster-core");
var busterPromise = require("buster-promise");

var colorOpt = {
    "none": { color: false, bright: false },
    "dim": { color: true, bright: false },
    "bright": { color: true, bright: true }
};

module.exports = buster.extend(buster.create(require("buster-cli")), {
    missionStatement: "Run Buster.JS tests on node, in browsers, or both",
    usage: "buster-test [options] [filters]",
    description:
        "\nOptionally provide a test name filter to run a selection of tests:\n" +
        "`buster-test configuration` runs all contexts/tests with the word\n" +
        "'configuration' in their name.",
    environmentVariable: "BUSTER_TEST_OPT",

    onRun: function () {
        var options = buster.extend({
            reporter: this.reporter.value,
            filters: this.filters.value,
            cwd: process.cwd(),
            server: this.serverConfig(),
            cacheResources: !this.reset.isSet
        }, colorOpt[this.color.value]);

        this.onConfig(function (err, groups) {
            if (err) {
                this.logger.e(err.message);
                if (err.stack) this.logger.e(err.stack);
            } else {
                function runGroup() {
                    if (groups.length == 0) return;
                    var config = groups.shift();
                    self.logger.info("Running tests:", config.name);
                    self.logger.info("Loading:", "\n  " + files(config).join("\n  "));
                    var runner = self.loadRunner(config.environment);
                    runner && runner.run(config, options, runGroup);
                }

                var self = this;
                runGroup();
            }
        }.bind(this));
    },

    loadOptions: function () {
        this.addConfigOption();

        this.reporter = this.opt("-r", "--reporter", "Test output reporter", {
            defaultValue: "dots",
            validators: { "reporter": "No such reporter '${1}'" }
        });

        this.color = this.opt("-C", "--color", "Output color scheme", {
            values: ["dim", "bright", "none"],
            defaultValue: "bright"
        });

        this.server = this.opt("-s", "--server", "Hostname and port to a running buster-server instance (for browser tests)", {
            defaultValue: "http://localhost:1111"
        });

        this.reset = this.opt("-R", "--reset",
                              "Don't use cached resources on the server.");

        this.args.addShorthand("--node", ["-e", "node"]);

        this.filters = this.args.createOperand();
        this.filters.greedy = true;
    },

    serverConfig: function () {
        var server = this.server.value;
        server = (/^:/.test(server) ? "127.0.0.1" : "") + server;
        return (!/^http\:\/\//.test(server) ? "http://" : "") + server;
    },

    loadRunner: function (env, config) {
        var module = "./runners/" + env + "-runner";
        if (!moduleExists(module)) {
            return this.err("Unknown environment '" + env + "'. Try one of:\n" +
                            availableRunners().join(", "));
        }

        var runner = Object.create(require("./runners/" + env + "-runner"));
        runner.logger = this.logger;
        return runner;
    }
});

function moduleExists(module) {
    try {
        return fs.statSync(path.join(__dirname, module + ".js")).isFile();
    } catch (e) {
        return false;
    }
}

function availableRunners() {
    return fs.readdirSync(path.join(__dirname, "runners"));
}

module.exports.helpTopics = {};
Object.defineProperty(module.exports.helpTopics, "reporters", {
    enumerable: true,
    get: function () {
        var testReporters = require("buster-test").reporters
        var reporters = Object.keys(testReporters).filter(function (r) {
            return typeof testReporters[r] == "object";
        });

        return "Buster.JS ships with a set of built-in reporters. These can be used by\n" +
"providing the name to the -r/--reporter option:\n" +
"buster-test -r dots\n\n" +
"The dots reporter is the default reporter. Built-in reporters\n" +
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
"at http://busterjs.org/docs/buster-test/reporters/";
    }
});

require("buster-args").validators.reporter = function (errMsg) {
    return function (arg, promise) {
        try {
            require("buster-test").reporters.load(arg.value);
            promise.resolve();
        } catch (e) {
            promise.reject(
                arg.signature + ": " + errMsg.replace("${1}", arg.value) +
                    "\n" + e.message + "\nLearn more about reporters with " +
                    "`buster-test -h reporters`");
        }
    }
};

function files(config) {
    return config.resourceSet && config.resourceSet.load || [];
}
