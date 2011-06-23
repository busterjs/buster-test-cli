var http = require("http");
var path = require("path");
var fs = require("fs");
var rmrf = require("rimraf");

var FIXTURES_ROOT = path.resolve(__dirname, "..", "fixtures");

var helper = module.exports = {
    FIXTURES_ROOT: FIXTURES_ROOT,

    require: function (mod) {
        return require("../../lib/buster-test-cli/" + mod);
    },

    cliTestSetUp: function (cli) {
        return function () {
            this.stub(process, "exit");
            helper.mkdir(FIXTURES_ROOT);
            process.chdir(FIXTURES_ROOT);
            var self = this;
            this.stdout = "";
            this.stderr = "";
            var j = [].join;

            this.cli = cli.create(
                {puts: function () { self.stdout += j.call(arguments, " ") + "\n"; }},
                {puts: function () { self.stderr += j.call(arguments, " ") + "\n"; }}
            );
        }
    },

    clientTearDown: function (done) {
        rmrf(FIXTURES_ROOT, function (err) {
            if (err) require("buster").log(err.toString());
            done();
        });
    },

    runTest: function (args, callback) {
        return function (done) {
            helper.run(this, args, function () {
                done();
                callback.call(this);
            });
        };
    },

    run: function (tc, args, callback) {
        tc.cli.run(args);

        setTimeout(function () {
            callback.call(tc);
        }, 5);
    },

    mkdir: function (dir) {
        var dirs = [FIXTURES_ROOT].concat(dir.split("/")), tmp = "";

        for (var i = 0, l = dirs.length; i < l; ++i) {
            tmp += dirs[i] + "/";

            try {
                fs.mkdirSync(tmp, "755");
            } catch (e) {}
        }
    },

    writeFile: function (file, contents) {
        file = path.join(FIXTURES_ROOT, file);
        this.mkdir(path.dirname(file));
        fs.writeFileSync(file, contents);
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
