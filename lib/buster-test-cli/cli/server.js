var http = require("http");
var buster = require("buster-core");
buster.args = require("buster-args");
buster.testServer = require("../server/middleware");
var validate = buster.args.validators;
var path = require("path");
var paperboy = require("paperboy");
var DOCUMENT_ROOT = path.join(path.dirname(__filename), "../../../public");

function err(stderr, message) {
    stderr.puts(message);
    process.exit(1);
}

module.exports = {
    create: function (stdout, stderr) {
        var cli = Object.create(this);
        cli.stdout = stdout;
        cli.stderr = stderr;

        return cli;
    },

    run: function (args) {
        this.options.handle(args, function (errors) {
            if (errors) {
                err(this.stderr, errors[0]);
            } else {
                if (this.wantsHelp) {
                    return this.printHelp();
                }

                try {
                    this.createServer().listen(this.port);
                    this.stdout.puts("buster-server listening on port " + this.port);
                } catch (e) {
                    if (e.message.indexOf("EADDRINUSE") == 0) {
                        err(this.stderr, "Address already in use. Pick another " +
                            "port with -p/--port to start buster-server");
                    }
                }
            }
        }.bind(this));
    },

    createServer: function () {
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

    printHelp: function () {
        this.stdout.puts(
            "Server for automating JavaScript test runs across browsers\n\n" +
                "Usage: buster server [-p 1111]\n" +
                "    -p/--port The port to run the server on (default 1111)\n" +
                "    -h/--help Print this message");
    },

    get options() {
        var args = Object.create(buster.args);
        this._port = args.createOption("-p", "--port");
        this._port.hasValue = true;
        this._port.defaultValue = 1111;
        this._port.addValidator(validate.integer("--port ($1) must be a number"));
        this._help = args.createOption("-h", "--help");

        return args;
    },

    get wantsHelp() {
        return this._help.isSet;
    },

    get port() {
        return this._port.value();
    }
};