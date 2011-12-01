var fs = require("fs");
var ejs = require("ejs");
var path = require("path");
var buster = require("buster-core");
buster.server = require("buster-capture-server");
var TEMPLATE_ROOT = path.join(path.dirname(__filename), "../../../templates");
var userAgentParser = require("buster-user-agent-parser");

function template(name, locals, callback) {
    var templatePath = path.join(TEMPLATE_ROOT, name + ".ejs");

    fs.readFile(templatePath, "utf-8", function (err, data) {
        if (err) throw err;
        callback(ejs.render(data, { locals: locals }));
    });
}

function addHeader(masterOfPuppets) {
    template("header", {}, function (string) {
        masterOfPuppets.header(80, {
            resources: {"/": {content: string}}
        });
    });
}

module.exports = {
    create: function (httpServer) {
        var server = Object.create(this);
        server.buster = buster.server.create();
        addHeader(server.buster);
        if (httpServer) server.buster.attach(httpServer);

        server.buster.oncapture = function (req, res, client) {
            client.agent = userAgentParser.parse(req.headers["user-agent"]);
            client.agent.userAgent = req.headers["user-agent"];
            res.writeHead(302, { "Location": client.url });
            res.end();
        };

        server.buster.capturePath = "/capture";
        return server;
    },

    respond: function (req, res) {
        if (this.serveTemplate(req, res)) return true;
        return false;
    },

    serveTemplate: function (req, res) {
        if (req.url != "/") return;
        res.writeHead(200, { "Content-Type": "text/html" });

        template("index", { clients: this.clients }, function (string) {
            res.end(string);
        });

        return true;
    },

    get clients() {
        return this.buster.capturedClients.map(function (c) {
            return c.agent;
        }).filter(function (a) { return !!a; });
    }
};
