var fs = require("fs");
var ejs = require("ejs");
var path = require("path");
var buster = require("buster-core");
buster.server = require("buster-server");
var TEMPLATE_ROOT = path.join(path.dirname(__filename), "../../../templates");

function template(name, locals, callback) {
    var templatePath = path.join(TEMPLATE_ROOT, name + ".ejs");

    fs.readFile(templatePath, "utf-8", function (err, data) {
        if (err) throw err;
        callback(ejs.render(data, { locals: locals }));
    });
}

module.exports = {
    create: function () {
        var server = Object.create(this);
        server.buster = buster.server.create();

        server.buster.capture.oncapture = function (req, res, client) {
            res.writeHead(302, { "Location": client.url });
            res.end();
        };

        server.buster.capture.captureUrl = "/capture";

        return server;
    },

    respond: function (req, res) {
        if (this.buster.respond(req, res)) return true;
        if (this.serveTemplate(req, res)) return true;

        return false;
    },

    serveTemplate: function (req, res) {
        if (req.url != "/") return;
        res.writeHead(200, { "Content-Type": "text/html" });

        template("index", { clients: this.clients || [] }, function (string) {
            res.end(string);
        });

        return true;
    },

    get clients() {
        return this.buster.capture.capturedClients.map(function (c) {
            return c.multicast && c.multicast.agent;
        }).filter(function (a) { return !!a; });
    }
};