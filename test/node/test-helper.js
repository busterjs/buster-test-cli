var http = require("http");
var path = require("path");
var fs = require("fs");

module.exports = {
    require: function (mod) {
        return require("../../lib/buster-test-cli/" + mod);
    },

    cliTestSetUp: function (cli) {
        return function () {
            this.stub(process, "exit");
            var self = this;
            this.stdout = "";
            this.stderr = "";

            this.cli = cli.create(
                {puts: function () { self.stdout += [].join.call(arguments, " "); }},
                {puts: function () { self.stderr += [].join.call(arguments, " "); }}
            );
        }
    },

    clientTearDown: function (done) {
        // rmdir
    },

    runTest: function (args, callback) {
        return function (done) {
            this.cli.run(args, function () {
                callback.call(this);
                done();
            }.bind(this));
        };
    },

    mkdir: function (dir) {
        var root = path.resolve(__dirname, "..");
        var dirs = dir.split("/"), tmp = root;

        for (var i = 0, l = dirs.length; i < l; ++i) {
            tmp += "/" + dirs[i];
            fs.mkdirSync(tmp, "755");
        }
    },

    requestHelperFor: function (host, port) {
        var helper = Object.create(this);
        helper.host = host;
        helper.port = port;

        return helper;
    },

    request: function (method, url, headers, callback) {
        if (typeof headers == "function") {
            callback = headers;
            headers = {};
        }

        http.request({
            method: method.toUpperCase(),
            host: this.host || "localhost",
            port: this.port || 9999,
            path: url,
            headers: headers
        }, function (res) {
            var body = "";
            res.on("data", function (chunk) { body += chunk; });
            res.on("end", function () { callback(res, body); });
        }).end();
    },

    get: function (url, headers, callback) {
        return this.request("GET", url, headers, callback);
    },

    post: function (url, headers, callback) {
        return this.request("POST", url, headers, callback);
    },

    captureClient: function (ua, callback) {
        this.get("/capture", function (res, body) {
            var uid = res.headers.location.split("/").pop();
            var url = "/clients/" + uid + "/createMulticast";

            this.post(url, { "User-Agent": ua }, function (res, body) {
                callback();
            }.bind(this));
        }.bind(this));
    }
};
