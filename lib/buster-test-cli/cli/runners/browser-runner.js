var buster = require("buster-core");
buster.stackFilter = require("buster-test").stackFilter;
var path = require("path");
var url = require("url");
var busterClient = require("buster-client").client;
var bRemoteRunner = require("../../test-runner/remote-runner");
var bProgressReporter = require("../../test-runner/progress-reporter");
var bReporters = require("buster-test").reporters;
var bConfigExt = require("../../config");

module.exports = {
    run: function (config, options, done) {
        this.callback = done;
        this.options = buster.extend({}, options, config.options);
        this.server = url.parse(options.server);

        var client = busterClient.create(this.server.port, this.server.hostname);
        client.cacheResources = !!options.cacheResources;
        bConfigExt.extendConfigurationGroupWithWiring(config);

        this.logger.info("Creating browser session");
        client.createSession({
            resourceSet: config.resourceSet,
            joinable: false,
            managed: true
        }).then(this.runSession.bind(this), this.errorHandler.bind(this));
    },

    runSession: function (session) {
        var opt = this.options || {};
        var logger = this.logger;
        logger.debug("Connected to server");

        if (logger.level == "debug") {
            session.onMessage(function () { logger.debug.apply(logger, arguments); });
        }

        session.on("uncaughtException", function (msg) {
            logger.warn("Uncaught exception: " + msg.data.message);
        });

        if (session.clients.length == 0) {
            return runComplete.call(this, session);
        }

        var runnerConfig = runnerConfiguration(opt, ["autoRun", "filters"]);
        var remoteRunner = bRemoteRunner.create(session.messagingClient,
                                                session.clients, runnerConfig);
        var reporter = createReporter.call(this, remoteRunner, session, opt);
        remoteRunner.on("suite:end", runComplete.bind(this, session));
    },

    errorHandler: function (err) {
        if (/ECONNREFUSED/.test(err.message)) {
            this.logger.e("Unable to connect to server");
            this.logger.e("Please make sure that buster-server is running at " +
                          this.server.href);
        } else if (/ENOENT/.test(err.message) && /'.*\*.*'/.test(err.message)) {
            var file = err.message.match(/'(.*)'/)[1].replace(process.cwd() + "/", "");
            this.logger.e("Configured pattern '" + file + "' does not match any files");
            this.logger.e("Unable to continue");
        } else if (/ENOENT/.test(err.message)) {
            var file = err.message.match(/'(.*)'/)[1].replace(process.cwd() + "/", "");
            this.logger.e("Configured path '" + file + "' is not a file or directory");
            this.logger.e("Unable to continue");
        } else {
            this.logger.e("Failed creating session: " + err.message);
        }

        if (typeof this.callback == "function") {
            this.callback();
        }
    }
};

function runComplete(session) {
    var callback = this.callback || function () {};
    var logger = this.logger;

    if (session.clients.length == 0) {
        var server = this.server && this.server.href || "http://??";
        logger.warn("No clients connected, nothing to do.");
        logger.warn("Capture browsers at " + server + " and try again.");
        logger.warn("You can do it, the force is with you!");
    }

    session.close().then(function () {
        logger.info("Successfully closed session");
        callback();
    }, function (err) {
        logger.debug("Failed closing session");
        logger.warn(err.message);
        callback();
    });
}

function runnerConfiguration(options, keys) {
    return buster.extend(keys.reduce(function (opts, key) {
        if (options.hasOwnProperty(key)) opts[key] = options[key];
        return opts;
    }, {}), { failOnNoAssertions: !!options.failOnNoAssertions });
}

function createIOStream(logger, level) {
    var stream = logger.streamForLevel(level);

    return {
        puts: function (msg) { return stream.write(msg + "\n"); },
        print: function (msg) { return stream.write(msg); }
    };
}

function createReporter(runner, session, options) {
    var logger = this.logger;
    var ioStream = createIOStream(this.logger, "log");

    if (!options.reporter || options.reporter == "dots") {
        var progressReporter = bProgressReporter.create({
            io: ioStream, color: !!options.color, bright: !!options.bright
        }).listen(runner);

        runner.on("client:connect", function (client) {
            progressReporter.addClient(client.id, client);
        });
    }

    var server = this.server || {};

    var reporter = bReporters.load(options.reporter || "dots").create({
        io: ioStream,
        color: !!options.color, bright: !!options.bright,
        displayProgress: false,
        cwd: "http://" + server.hostname + ":" + server.port +
            session.rootPath + "/resources"
    }).listen(runner);

    reporter.contextsInPackageName = 2;
    buster.stackFilter.filters = ["/buster/bundle-", "buster/wiring"];
    return reporter;
}

function serverConfig(opt) {
    if (opt && opt.server) return url.parse(opt.server);
    return { hostname: "localhost", port: "1111" };
}
