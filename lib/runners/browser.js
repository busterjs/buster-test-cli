var B = require("buster-core");
var captureServer = require("buster-capture-server");
var Url = require("url");
var terminal = require("buster-terminal");
var remoteRunner = require("./browser/remote-runner");
var progressReporter = require("./browser/progress-reporter");
var reporters = require("buster-test").reporters;

// Error codes, as per FreeBSD's sysexit(3)
// Errors are mapped to sysexit(3) error codes wherever that makes sense
var EX_DATAERR = 65;
var EX_SOFTWARE = 70;
var EX_TEMPFAIL = 75;
var EX_PROTOCOL = 76;
var EX_CONFIG = 78;

function serverURL(options) {
    var href = options && options.server || "";
    if (href && !/:\/\//.test(href)) { href = "http://" + href; }
    return Url.parse(href);
}

function createServerClient(options) {
    var url = serverURL(options);
    return captureServer.createServerClient(url.port, url.hostname);
}

function logSessionLifeCycle(s, l) {
    s.onStart(function () { l.info("Connected to server, waiting for browsers"); });
    s.onLoad(function () { l.info("All browsers aboard, running tests"); });
    s.onEnd(function () { l.info("Done running tests, closing browser sessions"); });
    s.onUnload(function () { l.info("All browsers free for new tasks"); });
}

function logSessionMessages(session, logger) {
    // TODO: August is working on an attachable logger for the session
    //     if (logger.level == "debug") {
    //         session.on(function () { logger.debug.apply(logger, arguments); });
    //     }
}

function terminalOptions(logger, options) {
    return {
        outputStream: logger.streamForLevel("log"),
        color: !!options.color,
        bright: !!options.bright
    };
}

function listenForUncaughtExceptions(sess, logger, S) {
    var listeners = sess.listeners && sess.listeners.uncaughtException || [];
    if (listeners.length > 0) { return; }
    sess.on("uncaughtException", function (msg) {
        logger.warn(S.yellow("Uncaught exception: " + msg.data.message));
    });
}

function opt(options, key, defaultValue) {
    return options.hasOwnProperty(key) ? options[key] : defaultValue;
}

function runnerOptions(options) {
    return {
        failOnNoAssertions: opt(options, "failOnNoAssertions", true),
        autoRun: opt(options, "autoRun", true),
        captureConsole: opt(options, "captureConsole", true),
        filters: opt(options, "filters", undefined)
    };
}

function noSlavesError(options) {
    var server = serverURL(options);
    server = server && server.href || "http://??";
    var error = new Error("No slaves connected, nothing to do.\n" +
                          "Capture browsers at " + server + " and try again.");
    error.code = EX_PROTOCOL;
    error.type = "NoSlavesError";
    return error;
}

function noSlaves(session, options, callback) {
    session.end();
    callback(noSlavesError(options));
}

function attachProgressReporter(runner, options) {
    var reporter = progressReporter.create(options);
    runner.on("client:connect", function (client) {
        reporter.addClient(client.id, client);
    });
    return reporter;
}

function loadReporter(session, terminalOpt, options) {
    var server = serverURL(options);
    var host = server.hostname + ":" + server.port;
    var reporter = reporters.load(options.reporter || "dots").create(
        buster.extend({
            logPassedMessages: !!options.logPassedMessages,
            displayProgress: false,
            cwd: "http://" + host + session.resourcesPath
        }, terminalOpt)
    );
    reporter.contextsInPackageName = 2;
    return reporter;
}

function sessionError(options, callback, error) {
    if (/ECONNREFUSED/.test(error.message)) {
        var server = serverURL(options);
        error = new Error(
            "Unable to connect to server\n" +
                "Please make sure that buster-server is running at " +
                server.href
        );
        error.code = EX_TEMPFAIL;
    } else {
        error.message = "Failed creating session: " + error.message;
    }

    callback(error);
}

function extractFile(error) {
    var match = error.match(/'(.*)'/);
    if (!match) { return ""; }
    var cwd = process.cwd() + "/";
    return match[1].replace(cwd, "");
}

function configError(callback, err) {
    var error = err;

    if (/ENOENT/.test(err.message) && /'.*\*.*'/.test(err.message)) {
        error = new Error("Configured pattern '" + extractFile(err.message) +
                          "' does not match any files");
        error.code = EX_DATAERR;
    } else if (/ENOENT/.test(err.message)) {
        error = new Error("Configured path '" + extractFile(err.message) +
                          "' is not a file or directory");
        error.code = EX_DATAERR;
    }
    callback(error);
}

var testRun = {
    create: function (config, options, logger, done) {
        return B.extend(B.create(this), {
            config: config,
            options: options,
            callback: done,
            logger: logger,
            formatter: terminal.create(terminalOptions(logger, options))
        });
    },

    done: function (err) {
        if (!this.callback) { return; }
        if (err) { err.code = err.code || EX_SOFTWARE; }
        this.callback.apply(this, arguments);
        delete this.callback;
    },

    abort: function (err) {
        this.aborted = true;
        this.done(err);
    },

    endSession: function (session) {
        this.logger.info("Successfully closed session");
        session.end();
    },

    testRunHook: function (runner, session, callback) {
        try {
            this.config.runExtensionHook("testRun", runner, session);
            return true;
        } catch (err) {
            err.code = EX_SOFTWARE;
            callback(err);
        }
    },

    createRemoteRunner: function (session) {
        return remoteRunner.create(session, session.slaves, {
            failOnNoAssertions: opt(this.options, "failOnNoAssertions", true),
            autoRun: opt(this.options, "autoRun", true),
            captureConsole: opt(this.options, "captureConsole", true),
            filters: opt(this.options, "filters", undefined)
        });
    },

    attachReporter: function (runner, session) {
        var terminalOpt = terminalOptions(this.logger, this.options);
        if (!this.options.reporter) { 
            attachProgressReporter(runner, terminalOpt);
        }
        loadReporter(session, terminalOpt, this.options);
    },

    runTests: function (session, callback) {
        callback = callback || function () {}; // TODO: Callback is not optional
        listenForUncaughtExceptions(session, this.logger, this.formatter);
        if (session.slaves.length === 0) {
            return noSlaves(session, this.options, callback);
        }
        var runner = this.createRemoteRunner(session);
        if (!this.testRunHook(runner, session, callback)) { return; }
        this.attachReporter(runner, session);
        runner.on("suite:end", function () {
            this.endSession(session);
            callback();
        }.bind(this));
    },

    startSession: function (client, callback) {
        return function (resourceSet) {
            if (this.aborted) { return callback(); }
            this.logger.info("Creating browser session");
            client.createSession(resourceSet, {
                cache: this.cacheable,
                joinable: false,
                staticResourcesPath: !!this.options.staticResourcesPath
            }).then(
                B.partial(callback, null),
                B.partial(sessionError, this.options, callback)
            );
        }.bind(this);
    },

    start: function () {
        var client = createServerClient(this.options);
        var done = B.bind(this, "done");
        this.config.resolve().then(this.startSession(client, function (err, session) {
            if (this.aborted) { return this.endSession(session); }
            this.options = B.extend({}, this.options, this.config.options);
            logSessionLifeCycle(session, this.logger);
            logSessionMessages(session, this.logger);
            this.runTests(session, done);
        }.bind(this)), B.partial(configError, done));
    }
};

module.exports = {
    testRun: testRun,

    run: function (config, options, done) {
        var run = testRun.create(config, options || {}, this.logger, done);
        run.cacheable = this.cacheable;
        run.start();
        return run;
    },

    // OLD, busted

    runSession_: function (session) {
        var opt = this.options || {};
        var logger = this.logger;
        logger.debug("Connected to server");

        if (logger.level == "debug") {
            session.onMessage(function () { logger.debug.apply(logger, arguments); });
        }

        if (session.slaves.length == 0) {
            return runComplete.call(this, session);
        }

        if (opt.reporter && opt.reporter !== "dots") {
            var t = terminal.create(terminalOptions.call(this));
            session.on("uncaughtException", function (msg) {
                logger.warn(t.yellow("Uncaught exception: " + msg.data.message));
            });
        }

        logger.debug("Initializing remote runner with " + (session.slaves || []).length + " slaves");
        var runnerConfig = runnerConfiguration(opt, ["autoRun", "filters", "captureConsole"]);
        var messaging = session.messagingClient;
        var remoteRunner = bRemoteRunner.create(messaging, session.slaves, runnerConfig);
        remoteRunner.logger = logger;
        var reporter = createReporter.call(this, remoteRunner, session, opt);
        remoteRunner.on("suite:end", runComplete.bind(this, session));
        try {
            this.config.runExtensionHook("testRun", remoteRunner, messaging);
        } catch (e) {
            this.logger.error(e.message);
            process.exit(70);
        }
    },

    onError: function (err) {
        var file;
        if (/ECONNREFUSED/.test(err.message)) {
            this.logger.e("Unable to connect to server");
            this.logger.e("Please make sure that buster-server is running at " +
                          this.server.href);
            err.code = EX_TEMPFAIL;
        } else if (/ENOENT/.test(err.message) && /'.*\*.*'/.test(err.message)) {
            file = err.message.match(/'(.*)'/)[1].replace(process.cwd() + "/", "");
            this.logger.e("Configured pattern '" + file + "' does not match any files");
            this.logger.e("Unable to continue");
            err.code = EX_DATAERR;
        } else if (/ENOENT/.test(err.message)) {
            file = err.message.match(/'(.*)'/)[1].replace(process.cwd() + "/", "");
            this.logger.e("Configured path '" + file + "' is not a file or directory");
            this.logger.e("Unable to continue");
            err.code = EX_DATAERR;
        } else if (err.name == "AbortedError") {
            this.logger.d("Session creation aborted, presumably by analyzer");
            err.code = EX_SOFTWARE;
        } else {
            this.logger.e(err.message || err);
            err.code = EX_CONFIG;
        }
        if (typeof this.callback == "function") {
            this.callback(err);
        }
    }
};

function runComplete(session, results) {
    var callback = this.callback || function () {};
    var logger = this.logger;
    var error = null;

    if (session.slaves.length == 0) {
        var server = this.server && this.server.href || "http://??";
        error = new Error("No slaves connected, nothing to do.\n" +
                          "Capture browsers at " + server + " and try again.");
        error.code = EX_PROTOCOL;
        error.type = "NoSlavesError";
        logger.warn("No slaves connected, nothing to do.");
        logger.warn("Capture browsers at " + server + " and try again.");
        logger.warn("You can do it, the force is with you!");
    }

    session.close().then(function () {
        logger.info("Successfully closed session");
        callback(error, results);
    }, function (err) {
        logger.debug("Failed closing session");
        logger.warn(err.message);
        var error = new Error("Failed closing session: " + err.message);
        error.code = EX_TEMPFAIL;
        error.type = "SessionCloseError";
        callback(error);
    });
}

function runnerConfiguration(options, keys) {
    return buster.extend(keys.reduce(function (opts, key) {
        if (options.hasOwnProperty(key)) opts[key] = options[key];
        return opts;
    }, {}), {
        failOnNoAssertions: typeof options.failOnNoAssertions == "boolean" ? options.failOnNoAssertions : true
    });
}

function createReporter(runner, session, options) {
    var logger = this.logger;
    var terminalOpt = terminalOptions.call(this);

    if (!options.reporter || options.reporter == "dots") {
        var progressReporter = bProgressReporter.create(terminalOpt).listen(runner);

        runner.on("client:connect", function (client) {
            progressReporter.addClient(client.id, client);
        });

        session.on("uncaughtException", function (msg) {
            progressReporter.uncaughtException(msg.clientId, msg.data.message);
        });
    }

    var server = this.server || {};

    var reporter = bReporters.load(options.reporter || "dots").create(
        buster.extend({
            logPassedMessages: !!options.logPassedMessages,
            displayProgress: false,
            cwd: "http://" + server.hostname + ":" + server.port + session.resourcesPath
        }, terminalOpt)
    ).listen(runner);
    reporter.contextsInPackageName = 2;
    buster.stackFilter.filters = ["/buster/bundle-",
                                  "buster/wiring",
                                  "buster-capture-server/node_modules"];

    return reporter;
}

function _terminalOptions() {
    return {
        outputStream: this.logger.streamForLevel("log"),
        color: !!this.options.color,
        bright: !!this.options.bright
    };
}
