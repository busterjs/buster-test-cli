var http = require("http");
var path = require("path");
var paperboy = require("paperboy");

var buster = require("buster-core");
buster.args = require("buster-args");
buster.testServer = require("../server/middleware");
buster.cli = require("../cli");
var validate = buster.args.validators;

var DOCUMENT_ROOT = path.join(path.dirname(__filename), "../../../public");

module.exports = buster.extend(buster.create(buster.cli), {
    missionStatement: "Server for automating JavaScript test runs across browsers",
    usage: "Usage: buster server [-p 1111]",

    onRun: function onRun(args) {
        try {
            this.createServer().listen(this.port());
            this.stdout.puts("buster-server listening on port " + this.port());
        } catch (e) {
            if (e.message.indexOf("EADDRINUSE") == 0) {
                this.err("Address already in use. Pick another " +
                         "port with -p/--port to start buster-server");
            }
        }
    },

    createServer: function createServer() {
        var middleware = buster.testServer.create();
        
        return http.createServer(function (req, res) {
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
        }.bind(this));
    },

    options: function options() {
        var args = Object.create(buster.args);
        this._port = args.createOption("-p", "--port");
        this._port.hasValue = true;
        this._port.defaultValue = 1111;
        this._port.addValidator(validate.integer("--port ($1) must be a number"));
        this._port.help = "The port to run the server on (default 1111)";

        return args;
    },

    port: function port() {
        return this._port.value();
    }
});