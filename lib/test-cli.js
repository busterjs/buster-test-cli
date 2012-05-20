var fs = require("fs");
var ejs = require("ejs");
var path = require("path");
var B = require("buster-core");
var cli = require("buster-cli");
var bTest = require("buster-test");
var args = require("buster-args");
var createAnalyzer = require("./analyzer").createAnalyzer;
var TEMPLATE_ROOT = path.join(__dirname, "../views");

var colorOpt = {
    none: { color: false, bright: false },
    dim: { color: true, bright: false },
    bright: { color: true, bright: true }
};

function files(config) {
    return config.resourceSet && config.resourceSet.load || [];
}

function template(templateRoot, name, locals, callback) {
    var templatePath = path.join(templateRoot, name + ".ejs");
    var content = fs.readFileSync(templatePath, "utf-8");
    return ejs.render(content, { locals: locals });
}

function helpTopics(templateRoot) {
    return {
        get reporters() {
            var reporters = bTest.reporters;
            return template(templateRoot, "help-reporters", {
                reporters: Object.keys(reporters).filter(function (r) {
                    return typeof reporters[r] == "object";
                })
            });
        }
    };
}

args.validators.reporter = function (errMsg) {
    return function (arg, promise) {
        try {
            promise.resolve(bTest.reporters.load(arg.value));
        } catch (e) {
            promise.reject(
                arg.signature + ": " + errMsg.replace("${1}", arg.value) +
                    "\n" + e.message + "\nLearn more about reporters with `" +
                    path.basename(process.argv[1]) + " -h reporters`");
        }
    };
};

function addCLIArgs(cli) {
    return {
        reporter: cli.opt("-r", "--reporter", "Test output reporter", {
            defaultValue: "dots",
            validators: { "reporter": "No such reporter '${1}'" }
        }),

        color: cli.opt("-C", "--color", "Output color scheme", {
            values: ["dim", "bright", "none"],
            defaultValue: "bright"
        }),

        server: cli.opt(
            "-s",
            "--server",
            "Hostname and port to a running buster-server instance", {
                defaultValue: "http://localhost:1111"
            }
        ),

        reset: cli.opt(
            "-R",
            "--reset",
            "Don't use cached resources on the server."
        ),

        warnings: cli.opt("-W", "--warnings", "Warnings to print", {
            values: ["fatal", "error", "warning", "all", "none"],
            defaultValue: "all"
        }),

        failOn: cli.opt("-F", "--fail-on", "Fail on warnings at this level", {
            values: ["fatal", "error", "warning"],
            defaultValue: "fatal"
        }),

        logAll: cli.opt(
            "-L",
            "--log-all",
            "Log all messages, including for passed tests"
        ),

        releaseConsole: cli.opt(
            "-o",
            "--release-console",
            "By default, Buster captures log messages from console.log " +
                "and friends. It does so by replacing the global console object " +
                "with the buster.console object. This option skips this hijacking."
        ),

        staticResourcePath: cli.opt(
            "-p",
            "--static-paths",
            "Serve files over a static URL on the server. Reusing paths "+
                "across test runs makes it possible to use breakpoints, " +
                "but increases the risk of stale resources due to the " +
                "browser caching too eagerly"
        ),

        filters: cli.opd(
            "FILTER",
            "Partial match against names of tests to run",
            { greedy: true }
        ),

        node: cli.shorthand("--node", ["-e", "node"]),
        browser: cli.shorthand("--browser", ["-e", "browser"])
    };
}

var EX_SOFTWARE = 70;

function exitCode(runs) {
    for (var i = 0, l = runs.length; i < l; ++i) {
        if (runs[i].error) { return runs[i].error.code || EX_SOFTWARE; }
        if (!runs[i].results.ok) { return 1; }
    }
    return 0;
}

function serverConfig(args) {
    var server = args.server.value;
    server = (/^:/.test(server) ? "127.0.0.1" : "") + server;
    return (!/^http\:\/\//.test(server) ? "http://" : "") + server;
}

function prepareOptions(prefs, args) {
    return B.extend({
        reporter: args.reporter.value,
        filters: args.filters.value,
        cwd: process.cwd(),
        server: serverConfig(args),
        cacheResources: !args.reset.isSet,
        warnings: args.warnings.value,
        failOn: args.failOn.value,
        captureConsole: !cli.pref(prefs, args.releaseConsole, "test.releaseConsole"),
        staticResourcePath: args.staticResourcePath.isSet,
        logPassedMessages: cli.pref(prefs, args.logAll, "test.logAll")
    }, colorOpt[cli.pref(prefs, args.color, "test.color")]);
}

function runWithAnalyzer(runner, group, options, logger, callback) {
    var analyzer = createAnalyzer(logger, options);
    runner.cacheable = options.cacheResources;
    runner.run(group, options, function () {
        if (callback) {
            callback.apply(this, arguments);
            callback = null;
        }
    });

    analyzer.on("fail", function (stats) {
        var err = new Error("Pre-condition failed");
        err.type = "AnalyzerError";
        err.code = EX_SOFTWARE;
        err.stats = stats;
        runner.abort(err);
        if (callback) {
            callback(err);
            callback = null;
        }
    });

    ["fatal", "error", "warning"].forEach(function (level) {
        analyzer.on(level, function () { runner.cacheable = false; });
    });
}

module.exports = {
    create: function (stdout, stderr, options) {
        options = options || {};
        var c = cli.create(options);
        var logger = c.createLogger(stdout, stderr);
        if (options.missionStatement) {
            c.addHelpOption(
                options.missionStatement,
                options.description || "",
                helpTopics(options.templateRoot || TEMPLATE_ROOT)
            );
        }
        return B.extend(B.create(this), {
            cli: c,
            logger: logger,
            runners: options.runners || {},
            configBaseName: options.configBaseName || "buster",
            preferences: options.preferences
        });
    },

    run: function (cliArgs, callback) {
        callback = callback || function () {};
        this.cli.addConfigOption(this.configBaseName);
        var args = addCLIArgs(this.cli);
        this.cli.parseArgs(cliArgs, function (err) {
            if (err || this.cli.loggedHelp) {
                return callback(err, !err && this);
            }
            this.cli.loadConfig(B.bind(this, function (err, groups) {
                if (err) {
                    this.logger.e(err.message);
                    return callback(err);
                }
                this.runConfigGroups(
                    groups, prepareOptions(this.preferences, args), callback
                );
            }));
        }.bind(this));
    },

    runConfigGroups: function (configGroups, options, callback) {
        var runs = [];
        var groups = configGroups.slice();
        var nextGroup = function (err, results) {
            if (err || results) { runs.push({ error: err, results: results }); }
            var group = groups.shift();
            if (!group) { return this.exit(exitCode(runs), callback); }
            this.runConfig(group, options, nextGroup);
        }.bind(this);
        nextGroup();
    },

    runConfig: function (group, options, callback) {
        this.logger.info("Running tests:", group.name);
        this.logger.debug("Loading:", "\n  " + files(group).join("\n  "));
        this.loadRunner(group.environment, function (err, runner) {
            if (err) {
                this.logger.error("Unable to run configuration '" +
                                  group.name + "': " + err.message);
                return callback(err);
            }
            runWithAnalyzer(runner, group, options, this.logger, callback);
        }.bind(this));
    },

    loadRunner: function (env, callback) {
        var runnerModule = this.runners[env];
        if (!runnerModule) {
            return callback(new Error("No runner for environment '" + env +
                                      "'.\nTry one of: " +
                                      Object.keys(this.runners).join(", ")));
        }
        callback(null, B.extend(B.create(runnerModule), {
            logger: this.logger
        }));
    },

    exit: function (exitCode, callback) {
        callback(exitCode);
        this.cli.exit(exitCode);
    },

    // TODO/TMP: Not sure about this
    runners: {
        get node() { return require("./runners/node"); },
        get browser() { return require("./runners/browser"); }
    }
};
