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
        var server = url.parse(options.server);

        try {
            var client = busterClient.create(server.port, server.hostname);
            bConfigExt.extendConfigurationGroup(config);

            client.createSession(config.sessionConfig).then(
                this.runSession.bind(this), function (err) {
                    this.logger.e("Failed creating session: " + err.message);
                }.bind(this));
        } catch (e) {
            this.logger.e("Unable to connect to server");
            this.logger.e("Please make sure that buster-server is running at " +
                          server.href);
            this.logger.e("Also make sure that the server is reachable from your machine");
        }
    },

    runSession: function (session) {
        session.on("uncaughtException", function (msg) {
            console.log("Major malfunction: " + msg.data.message);
        });

        var remoteRunner = bRemoteRunner.create(session.multicaster, {
            failOnNoAssertions: false
        });

        var progressReporter = bProgressReporter.create({
            io: require("sys"), color: true, bright: true
        }).listen(remoteRunner);

        var reporter = bReporters.xUnitConsole;

        remoteRunner.on("client:connect", function (client) {
            progressReporter.addClient(client.id, client);
        });

        var reporterInstance = reporter.create({
            io: require("sys"),
            color: true, bright: true, displayProgress: false,
            cwd: "http://localhost:1111" + session.rootPath + "/resources"
        }).listen(remoteRunner);

        reporterInstance.contextsInPackageName = 2;

        //buster.stackFilter.filters = ["/buster/bundle-"];

        remoteRunner.on("suite:end", function () {
            session.close().then(function () {
                if (options["debug"]) {
                    console.log("Successfully closed session");
                }
            }, function (err) {
                console.log(err.message);
            });
        });
    }
};

function serverConfig(opt) {
    if (opt && opt.server) return url.parse(opt.server);
    return { hostname: "localhost", port: "1111" };
}
