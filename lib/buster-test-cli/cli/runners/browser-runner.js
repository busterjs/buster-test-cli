var buster = require("buster-core");
var path = require("path");
var url = require("url");
var busterClient = require("buster-client").client;
var bRemoteRunner = require("../../test-runner/remote-runner");
var bProgressReporter = require("../../test-runner/progress-reporter");
var bReporters = require("buster-test").reporters;
var bConfigExt = require("../../config");

module.exports = {
    run: function (config, options) {
        this.options = options;
        this.server = url.parse(options.server);

        var client = busterClient.create(this.server.port, this.server.hostname);
        client.cacheResources = !!options.cacheResources;
        bConfigExt.extendConfigurationGroup(config);

        this.logger.info("Creating browser session");

        client.createSession(config.sessionConfig).then(
            this.runSession.bind(this), this.errorHandler.bind(this));
    },

    runSession: function (session) {
        var opt = this.options || {};
        var logger = this.logger;
        logger.debug("Connected to server"); 

        session.on("uncaughtException", function (msg) {
            logger.warn("Uncaught exception: " + msg.data.message);
        });

        var remoteRunner = bRemoteRunner.create(session.multicaster, {
            failOnNoAssertions: !!opt.failOnNoAssertions
        });

        var reporter = createReporter.call(this, remoteRunner, session, opt);
        buster.stackFilter.filters = ["/buster/bundle-"];

        remoteRunner.on("suite:end", function () {
            session.close().then(function () {
                logger.info("Successfully closed session");
            }, function (err) {
                logger.debug("Failed closing session");
                logger.warn(err.message);
            });
        });
    },

    errorHandler: function (err) {
        if (/ECONNREFUSED/.test(err.message)) {
            this.logger.e("Unable to connect to server");
            this.logger.e("Please make sure that buster-server is running at " +
                          this.server.href);
        } else {
            this.logger.e("Failed creating session: " + err.message);
        }
    }
};

function createReporter(runner, session, options) {
    var logger = this.logger;

    var progressReporter = bProgressReporter.create({
        io: require("sys"), color: !!options.color, bright: !!options.bright
    }).listen(runner);

    runner.on("client:connect", function (client) {
        progressReporter.addClient(client.id, client);
    });

    var server = this.server || {};

    var reporter = bReporters.xUnitConsole.create({
        io: require("sys"),
        color: !!options.color, bright: !!options.bright,
        displayProgress: false,
        cwd: "http://" + server.hostname + ":" + server.port +
            session.rootPath + "/resources"
    }).listen(runner);

    reporter.contextsInPackageName = 2;
    return reporter;
}

function serverConfig(opt) {
    if (opt && opt.server) return url.parse(opt.server);
    return { hostname: "localhost", port: "1111" };
}
