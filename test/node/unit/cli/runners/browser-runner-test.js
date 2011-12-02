var helper = require("../../../test-helper");
var buster = require("buster");
var stdioLogger = require("buster-stdio-logger");
var assert = buster.assert;
var refute = buster.refute;
var browserRunner = helper.require("cli/runners/browser-runner");
var busterClient = require("buster-client").client;
var busterConfigExt = helper.require("config");
var busterPromise = require("buster-promise");
var remoteRunner = helper.require("test-runner/remote-runner");
var progressReporter = helper.require("test-runner/progress-reporter");
var bayeuxEmitter = require("buster-bayeux-emitter");
var reporters = require("buster-test").reporters;
var http = require("http");

buster.testCase("Browser runner", {
    setUp: function () {
        this.sessionPromise = busterPromise.create();
        this.client = { createSession: this.stub().returns(this.sessionPromise) };
        this.stub(busterClient, "create").returns(this.client);
        this.stub(busterConfigExt, "extendConfigurationGroupWithWiring");
        this.options = { server: "http://127.0.0.1:1200" };
        this.runner = Object.create(browserRunner);
        this.runner.options = { clients: [{ id: 1 }]};

        var self = this;
        this.stdout = "";
        this.stderr = "";

        this.runner.logger = stdioLogger(
            { write: function (msg) { self.stdout += msg; } },
            { write: function (msg) { self.stderr += msg; } });
    },

    "should create client for configured location": function () {
        this.runner.run({ load: [] }, this.options);

        assert.calledWith(busterClient.create, "1200", "127.0.0.1");
    },

    "should create non-caching client": function () {
        this.options.cacheResources = false;
        this.runner.run({ load: [] }, this.options);

        var client = busterClient.create.returnValues[0];
        refute(client.cacheResources);
    },

    "should create explicitly caching client": function () {
        this.options.cacheResources = true;
        this.runner.run({ load: [] }, this.options);

        var client = busterClient.create.returnValues[0];
        assert(client.cacheResources);
    },

    "should extend configuration": function () {
        var config = { id: 42 };
        this.runner.run(config, this.options);

        assert.calledOnce(busterConfigExt.extendConfigurationGroupWithWiring);
        assert.calledWith(busterConfigExt.extendConfigurationGroupWithWiring, config);
    },

    "should create unjoinable session using provided resource set": function () {
        this.runner.run({ resourceSet: { id: 41 } }, this.options);

        assert.calledOnce(this.client.createSession);
        assert.calledWith(this.client.createSession, {
            resourceSet: { id: 41 },
            joinable: false,
            managed: true
        });
    },

    "should be run with runSession": function () {
        this.stub(this.runner, "runSession");
        this.runner.run({ resourceSet: { id: 41 } }, this.options);

        this.sessionPromise.resolve({ id: 47 });

        assert.calledOnce(this.runner.runSession);
        assert.calledOn(this.runner.runSession, this.runner);
        assert.calledWith(this.runner.runSession, { id: 47 });
    },

    "session": {
        setUp: function () {
            this.session = buster.eventEmitter.create();
            this.session.onMessage = function () {};
            this.session.messagingClient = this.session;
            this.session.clients = [{ id: 1 }];
            this.closePromise = busterPromise.create();
            this.session.close = this.stub().returns(this.closePromise);
            this.stackFilter = buster.stackFilter.filters;

            this.emitSessionMessage = function (event, data) {
                this.session.emit(event, { data: data });
            };
        },

        tearDown: function () {
            buster.stackFilter.filters = this.stackFilter;
        },

        "should listen for uncaught exceptions": function () {
            this.runner.runSession(this.session);

            this.emitSessionMessage("uncaughtException", { message: "Oh noes" });

            assert.match(this.stderr, "Uncaught exception:");
            assert.match(this.stderr, "Oh noes");
        },

        "should create remote runner": function () {
            this.spy(remoteRunner, "create");
            this.runner.runSession(this.session);

            assert.calledOnce(remoteRunner.create);
            assert.calledWith(remoteRunner.create,
                              this.session.messagingClient, [{id: 1}], {
                failOnNoAssertions: false
            });
        },

        "should create remote runner that fails on no assertions": function () {
            this.spy(remoteRunner, "create");
            this.runner.options.failOnNoAssertions = true;
            this.runner.runSession(this.session);

            assert.calledWith(
                remoteRunner.create,
                this.session.messagingClient, [{id: 1}], { failOnNoAssertions: true });
        },

        "should create remote runner that does not auto run": function () {
            this.spy(remoteRunner, "create");
            this.runner.options.autoRun = true;
            this.runner.runSession(this.session);

            assert(remoteRunner.create.args[0][2].autoRun);
        },

        "should create remote runner with filters": function () {
            this.spy(remoteRunner, "create");
            this.runner.options.filters = ["1", "2"];
            this.runner.runSession(this.session);

            assert.equals(remoteRunner.create.args[0][2].filters, ["1", "2"]);
        },

        "with no connected clients": {
            setUp: function () {
                this.spy(remoteRunner, "create");
                this.session.clients = [];
                this.runner.runSession(this.session);
            },

            "does not create remote runner": function () {
                refute.called(remoteRunner.create);
            },

            "prints understandable error": function () {
                assert.match(this.stderr, "No clients connected, nothing to do");
            },

            "closes session": function () {
                assert.calledOnce(this.session.close);
            }
        },

        "should not call done callback when no clients until session closes": function () {
            this.runner.callback = this.spy();
            this.runner.runSession(this.session);

            refute.called(this.runner.callback);
        },

        "should create progress reporter": function () {
            this.spy(progressReporter, "create");

            this.runner.runSession(this.session);

            assert.calledOnce(progressReporter.create);
            assert.match(progressReporter.create.args[0][0], {
                color: false, bright: false
            });
        },

        "should not create progress reporter when providing reporter": function () {
            this.spy(progressReporter, "create");
            this.spy(reporters.specification, "create");
            this.runner.options = { reporter: "specification" };
            this.runner.runSession(this.session);

            refute.called(progressReporter.create);
            assert.calledOnce(reporters.specification.create);
        },

        "should load reporter using buster-test's loader": function () {
            this.spy(reporters, "load");
            this.runner.options = { reporter: "dots" };
            this.runner.runSession(this.session);

            assert.calledOnceWith(reporters.load, "dots");
        },

        "progress reporter should respect color settings": function () {
            this.spy(progressReporter, "create");

            this.runner.options = { color: true, bright: true };
            this.runner.runSession(this.session);

            assert.match(progressReporter.create.args[0][0], {
                color: true, bright: true
            });
        },

        "should use logger as io backend for remote reporter": function () {
            this.spy(progressReporter, "create");

            this.runner.runSession(this.session);
            var io = progressReporter.create.args[0][0].io;
            io.print(".");
            io.print(".");
            io.puts(" OK!");

            assert.match(this.stdout, ".. OK!");
        },

        "should add client on progress reporter when client connects": function () {
            var runner = buster.eventEmitter.create();
            this.stub(remoteRunner, "create").returns(runner);
            this.stub(progressReporter, "addClient");

            this.runner.runSession(this.session);
            var client = { id: 42 };
            runner.emit("client:connect", client);

            assert.calledOnce(progressReporter.addClient);
            assert.calledWith(progressReporter.addClient, 42, client);
        },

        "should initialize reporter": function () {
            this.spy(reporters.dots, "create");

            this.runner.runSession(this.session);

            assert.match(reporters.dots.create.args[0][0], {
                color: false, bright: false, displayProgress: false
            });
        },

        "should initialize reporter with custom properties": function () {
            this.spy(reporters.dots, "create");

            this.runner.options = { color: true, bright: true, displayProgress: true };
            this.runner.runSession(this.session);

            assert.match(reporters.dots.create.args[0][0], {
                color: true, bright: true
            });
        },

        "should build cwd from session server and root": function () {
            this.runner.server = { hostname: "localhost", port: 1111 };
            this.session.rootPath = "/aaa-bbb";
            this.spy(reporters.dots, "create");

            this.runner.runSession(this.session);

            assert.match(reporters.dots.create.args[0][0], {
                cwd: "http://localhost:1111/aaa-bbb/resources"
            });
        },

        "should build cwd from non-default session server and root": function () {
            this.runner.server = { hostname: "somewhere", port: 2524 };
            this.session.rootPath = "/aaa-ccc";
            this.spy(reporters.dots, "create");

            this.runner.runSession(this.session);

            assert.match(reporters.dots.create.args[0][0], {
                cwd: "http://somewhere:2524/aaa-ccc/resources"
            });
        },

        "should set number of contexts in package name": function () {
            this.spy(reporters.dots, "create");

            this.runner.runSession(this.session);

            assert.equals(reporters.dots.create.returnValues[0].contextsInPackageName, 2);
        },

        "should set stackFilter.filters": function () {
            this.runner.runSession(this.session);

            assert.equals(buster.stackFilter.filters,
                          ["/buster/bundle-", "buster/wiring"]);
        },

        "should close session on suite:end": function () {
            var runner = buster.eventEmitter.create();
            this.stub(remoteRunner, "create").returns(runner);

            this.runner.runSession(this.session);
            runner.emit("suite:end");

            assert.calledOnce(this.session.close);
        },

        "succesful session close": {
            setUp: function () {
                this.remoteRunner = buster.eventEmitter.create();
                this.runner.callback = this.spy();
                this.stub(remoteRunner, "create").returns(this.remoteRunner);
                this.closePromise.resolve();
                this.runner.runSession(this.session);
            },

            "prints to stdout": function () {
                var stdout = this.stdout;
                this.remoteRunner.emit("suite:end");

                refute.equals(this.stdout, stdout);
            },

            "calls callback": function () {
                this.remoteRunner.emit("suite:end");

                assert.calledOnce(this.runner.callback);
            }
        },

        "should print to stderr on unsuccesful session close": function () {
            var runner = buster.eventEmitter.create();
            this.stub(remoteRunner, "create").returns(runner);
            this.closePromise.reject({ message: "Oops" });

            this.runner.runSession(this.session);
            var stderr = this.stderr;
            runner.emit("suite:end");

            refute.equals(this.stderr, stderr);
        }
    },

    "error handling": {
        setUp: function () {
            this.runner.run({ resourceSet: { id: 41 } }, this.options);
        },

        "should print session creation error to stderr": function () {
            this.sessionPromise.reject({ id: 47 });

            assert.match(this.stderr, "Failed creating session");
        },

        "should print understandable error if server cannot be reached": function () {
            this.sessionPromise.reject(new Error("ECONNREFUSED, Connection refused"));

            assert.match(this.stderr, "Unable to connect to server");
            assert.match(this.stderr, "http://127.0.0.1:1200");
            assert.match(this.stderr, "Please make sure that buster-server is running");
        },

        "should print understandable error if pattern matches no files": function () {
            this.stub(process, "cwd").returns("/home/christian/projects/buster/sample");
            this.sessionPromise.reject(new Error("ENOENT, No such file or directory '/home/christian/projects/buster/sample/src/*.js'"));

            assert.match(this.stderr, "pattern 'src/*.js' does not match any files");
        },

        "should print understandable error if a file could not be found": function () {
            this.stub(process, "cwd").returns("/home/christian/projects/buster/sample");
            this.sessionPromise.reject(new Error("ENOENT, No such file or directory '/home/christian/projects/buster/sample/src/trim.js'"));

            assert.match(this.stderr, "Configured path 'src/trim.js' is not a file or directory");
        }
    }
});
