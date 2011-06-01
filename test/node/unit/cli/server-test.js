var http = require("http");
var buster = require("buster");
var assert = buster.assert;
buster.server = require("buster-server");
var helper = require("../../test-helper").requestHelperFor("localhost", "9999");

buster.testCase("buster-server binary", {
    setUp: function () {
        this.cli = Object.create(helper.require("cli/server"));
        this.stub(process, "exit");
    },

    "run": {
        "should print to stderr if option handling fails": function () {
            this.stub(console, "error");

            this.cli.run(["--hey"]);

            assert.calledOnce(console.error);
        },

        "should print help message": function () {
            this.stub(console, "log");

            this.cli.run(["--help"]);

            assert.match(console.log.args[0][0], "Server for automating");
        },

        "should start server on default port": function () {
            this.stub(console, "log");
            var server = { listen: this.spy() };
            this.stub(this.cli, "createServer").returns(server);

            this.cli.run([]);

            assert.calledOnce(server.listen);
            assert.calledWith(server.listen, 1111);
        },

        "should start server on specified port": function () {
            this.stub(console, "log");
            var server = { listen: this.spy() };
            this.stub(this.cli, "createServer").returns(server);

            this.cli.run(["-p", "3200"]);

            assert.calledOnce(server.listen);
            assert.calledWith(server.listen, 3200);
        },

        "should print message if address is already in use": function () {
            this.stub(console, "error");
            var error = new Error("EADDRINUSE, Address already in use");
            var server = { listen: this.stub().throws(error) };
            this.stub(this.cli, "createServer").returns(server);

            this.cli.run(["-p", "3200"]);

            assert.match(console.error.args[0][0],
                         "Address already in use. Pick another port with -p/--port to start buster-server");
        }
    },

    "createServer": {
        setUp: function (done) {
            this.server = this.cli.createServer();
            this.server.listen(9999);
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
