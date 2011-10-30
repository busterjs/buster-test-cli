var http = require("http");
var path = require("path");
var paperboy = require("paperboy");
var buster = require("buster-core");
var bArgs = require("buster-args");
var testServer = require("../server/middleware");
var bCli = require("buster-cli");
var DOCUMENT_ROOT = path.join(path.dirname(__filename), "../../../public");

module.exports = buster.extend(buster.create(bCli), {
    missionStatement: "Server for automating JavaScript test runs across browsers",
    usage: "buster-server [options]",

    onRun: function onRun(args) {
        try {
            this.createServer(this.port());
            this.logger.log("buster-server running on http://localhost:" + this.port());
        } catch (e) {
            if (e.message.indexOf("EADDRINUSE") == 0) {
                this.err("Address already in use. Pick another " +
                         "port with -p/--port to start buster-server");
            }
        }
    },

    createServer: function createServer(port) {
        var middleware;

        var httpServer = http.createServer(function (req, res) {
            if (middleware.respond(req, res)) return;

            paperboy
                .deliver(DOCUMENT_ROOT, req, res)
                .addHeader("Expires", 300)
                .error(function(statCode, msg) {
                    res.writeHead(statCode, { "Content-Type": "text/plain" });
                    res.end("Error " + statCode);
                })
                .otherwise(function(err) {
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end("Error 404: File not found");
                });
        });

        httpServer.listen(port);
        middleware = testServer.create(httpServer);
        middleware.buster.logger = this.logger;
        return httpServer;
    },

    loadOptions: function options() {
        this._port = this.opt("-p", "--port", "The port to run the server on", {
            defaultValue: 1111,
            validators: { "integer": "--port ($1) must be a number" }
        });
    },

    port: function port() {
        return parseInt(this._port.value, 10);
    }
});