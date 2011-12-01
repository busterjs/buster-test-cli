var helper = require("../../test-helper").requestHelperFor("localhost", "9999");
var http = require("http");
var buster = require("buster");
buster.serverCli = helper.require("cli/server");
var assert = buster.assert;
var refute = buster.refute;
var run = helper.runTest;
buster.server = require("buster-capture-server");

buster.testCase("buster-server binary", {
    setUp: helper.cliTestSetUp(buster.serverCli),
    tearDown: helper.cliTestTearDown,

    "run": {
        "should print to stderr if option handling fails":
        run(["--hey"], function () {
            refute.equals(this.stderr, "");
        }),

        "should print help message": run(["--help"], function () {
            assert.match(this.stdout, "Server for automating");
            assert.match(this.stdout, "-h/--help");
            assert.match(this.stdout, "-p/--port");
        }),

        "should start server on default port": function (done) {
            var createServer = this.stub(this.cli, "createServer");

            helper.run(this, [], function () {
                assert.calledOnce(createServer);
                assert.calledWith(createServer, 1111);
                done();
            });
        },

        "should start server on specified port": function (done) {
            var createServer = this.stub(this.cli, "createServer");

            helper.run(this, ["-p", "3200"], function () {
                assert.calledOnce(createServer);
                assert.calledWith(createServer, 3200);
                done();
            });
        },

        "should print message if address is already in use": function (done) {
            var error = new Error("EADDRINUSE, Address already in use");
            this.stub(this.cli, "createServer").throws(error);

            helper.run(this, ["-p", "3200"], function () {
                assert.match(this.stderr, "Address already in use. Pick another " +
                             "port with -p/--port to start buster-server");
                done();
            });
        }
    },

    "createServer": {
        setUp: function (done) {
            this.server = this.cli.createServer(9999);
            done();
        },

        tearDown: function (done) {
            this.server.on("close", done);
            this.server.close();
        },

        "should redirect client when capturing": function (done) {
            helper.get("/capture", function (res, body) {
                done(function () {
                    assert.equals(res.statusCode, 302);
                    assert.match(res.headers.location, /\/clients\/[0-9a-z\-]+$/);
                });
            });
        },

        "should serve header when captured": function (done) {
            helper.get("/capture", function (res, body) {
                helper.get("/clientHeader/", function (res, body) {
                    done(function () {
                        assert.equals(res.statusCode, 200);
                        assert.match(body, "test slave");
                    });
                });
            });
        },

        "should serve static pages": function (done) {
            helper.get("/stylesheets/buster.css", function (res, body) {
                done(function () {
                    assert.equals(res.statusCode, 200);
                    assert.match(body, "body {");
                });
            });
        },

        "should serve templated pages": function (done) {
            helper.get("/", function (res, body) {
                done(function () {
                    assert.equals(res.statusCode, 200);
                    assert.match(body, "<h1>Capture browser as test slave</h1>");
                });
            });
        },

        "should report no clients initially": function (done) {
            helper.get("/", function (res, body) {
                done(function () {
                    assert.equals(res.statusCode, 200);
                    assert.match(body, "<h2>No connected clients</h2>");
                });
            });
        },

        "should report connected clients": function (done) {
            helper.captureClient("Mozilla/5.0 (X11; Linux x86_64; rv:2.0.1) Gecko/20100101 Firefox/4.0.1", function () {
                helper.get("/", function (res, body) {
                    done(function () {
                        assert.equals(res.statusCode, 200);
                        assert.match(body, "<h2>Connected clients</h2>");
                    });
                });
            });
        },

        "should report name of connected clients": function (done) {
            helper.captureClient("Mozilla/5.0 (X11; Linux x86_64; rv:2.0.1) Gecko/20100101 Firefox/4.0.1", function () {
                helper.get("/", function (res, body) {
                    done(function () {
                        assert.match(body, "<li class=\"firefox linux\">");
                        assert.match(body, "<h3>Firefox 4.0.1 Linux</h3>");
                    });
                });
            });
        },

        "should report name newly connected ones": function (done) {
            helper.get("/", function (res, body) {
                helper.captureClient("Mozilla/5.0 (X11; Linux x86_64; rv:2.0.1) Gecko/20100101 Firefox/4.0.1", function () {
                    helper.get("/", function (res, body) {
                        done(function () {
                            assert.match(body, "<li class=\"firefox linux\">");
                            assert.match(body, "<h3>Firefox 4.0.1 Linux</h3>");
                        });
                    });
                });
            });
        }
    }
});
