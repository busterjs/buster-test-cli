var buster = require("buster");
var stdioLogger = require("buster-stdio-logger");
var browserRunner = require("../../lib/runners/browser");
var testRun = browserRunner.testRun;
var captureServer = require("buster-capture-server");
var when = require("when");
var cliHelper = require("buster-cli/lib/test-helper");
var remoteRunner = require("../../lib/runners/browser/remote-runner");
// var busterClient = require("buster-client").client;
// var progressReporter = require("../../lib/runners/browser/progress-reporter");
// var bayeuxEmitter = require("buster-bayeux-emitter");
// var reporters = require("buster-test").reporters;
// var http = require("http");

function fakeConfig(tc) {
    return buster.extend(buster.eventEmitter.create(), {
        resolve: tc.stub().returns(when.defer().promise),
        runExtensionHook: tc.stub()
    });
}

function fakeSession(tc) {
    return buster.extend(buster.eventEmitter.create(), {
        onStart: tc.stub(),
        onLoad: tc.stub(),
        onEnd: tc.stub(),
        onUnload: tc.stub()
    });
}

function fakeServerClient(tc) {
    return {
        createSession: tc.stub().returns(when(fakeSession(tc)))
    };
}

buster.testCase("Browser runner", {
    setUp: function () {
        this.runner = buster.create(browserRunner);
        this.stdout = cliHelper.writableStream("stdout");
        this.stderr = cliHelper.writableStream("stderr");
        this.logger = stdioLogger(this.stdout, this.stderr);
        this.runner.logger = this.logger;
    },

    "server client": {
        setUp: function () {
            var client = fakeServerClient(this);
            this.stub(captureServer, "createServerClient").returns(client);
        },

        "creates server client": function () {
            this.runner.run(fakeConfig(this), {});

            assert.calledOnce(captureServer.createServerClient);
        },

        "creates client for configured location": function () {
            this.runner.run(fakeConfig(this), { server: "http://127.0.0.1:1200" });

            assert.calledWith(captureServer.createServerClient, "1200", "127.0.0.1");
        }
    },

    "session creation": {
        setUp: function () {
            var client = this.serverClient = fakeServerClient(this);
            this.stub(captureServer, "createServerClient").returns(this.serverClient);
            this.config = fakeConfig(this);

            buster.assertions.add("sessionOptions", {
                assert: function (opts) {
                    this.actual = client.createSession.args[0][1];
                    return buster.assertions.match(this.actual, opts);
                },
                assertMessage: "Expected createSession to be called with " +
                    "options ${0}, but was called with ${actual}"
            });
        },

        "not when config is not resolved": function () {
            this.runner.run(this.config, {});

            refute.called(this.serverClient.createSession);
        },

        "fails with message when config fails to resolve": "TODO",

        "with configured resource set": function (done) {
            this.config.resolve.returns(when({ id: 42 }));

            this.runner.run(this.config, {}, done(function () {
                assert.calledOnce(this.serverClient.createSession);
                assert.calledWith(this.serverClient.createSession, { id: 42 });
            }.bind(this)));
        },

        "caches resources when cacheable": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, {}, done(function () {
                assert.sessionOptions({ cache: true });
            }.bind(this)));

            run.cacheable = true;
            deferred.resolve({});
        },

        "skips caching when uncacheable": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, {}, done(function () {
                assert.sessionOptions({ cache: false });
            }.bind(this)));

            run.cacheable = false;
            deferred.resolve({});
        },

        "is unjoinable": function (done) {
            this.config.resolve.returns(when({ id: 42 }));

            this.runner.run(this.config, {}, done(function () {
                assert.sessionOptions({ joinable: false });
            }.bind(this)));
        },

        "uses dynamic resource paths by default": function (done) {
            this.config.resolve.returns(when({ id: 42 }));

            this.runner.run(this.config, {}, done(function () {
                assert.sessionOptions({ staticResourcesPath: false });
            }.bind(this)));
        },

        "uses static resource paths": function (done) {
            this.config.resolve.returns(when({ id: 42 }));

            this.runner.run(this.config, {
                staticResourcePath: true
            }, done(function () {
                assert.sessionOptions({ staticResourcesPath: false });
            }.bind(this)));
        },

        "runs session with testRun object": function () {
            var session = fakeSession(this);
            this.serverClient.createSession.returns(when(session));
            var deferred = when.defer();
            this.config.resolve.returns(deferred);

            var run = this.runner.run(this.config, {});
            this.stub(run, "runTests").yields();
            deferred.resolve({});

            assert.calledOnce(run.runTests);
            assert.calledWith(run.runTests, session);
        },

        "adds resolved config options to options": function () {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, { id: 42 });
            this.stub(run, "runTests").yields();
            this.config.options = { things: "stuff" };
            deferred.resolve({});

            assert.equals(run.options, {
                id: 42,
                things: "stuff"
            });
        }
    },

    "abort": {
        setUp: function () {
            this.serverClient = fakeServerClient(this);
            this.stub(captureServer, "createServerClient").returns(this.serverClient);
            this.config = fakeConfig(this);
        },

        "prevents session creation": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, {}, done(function () {
                refute.called(this.serverClient.createSession);
            }.bind(this)));

            run.abort();
            deferred.resolve({});
        },

        "ends session if running": function (done) {
            this.config.resolve.returns(when({}));
            var session = { end: this.spy() };
            var deferred = when.defer();
            deferred.promise.id = 42;
            this.serverClient.createSession.returns(deferred.promise);

            var run = this.runner.run(this.config, {}, function () {
                process.nextTick(done(function () {
                    assert.calledOnce(session.end);
                }));
            });

            run.abort();
            deferred.resolve(session);
        },

        "calls run-callback with abort error": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred);

            var run = this.runner.run(this.config, {}, done(function (err) {
                assert.equals(err.code, 42);
            }));

            run.abort({ code: 42 });
            deferred.resolve({});
        },

        "sets error code if not present": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred);

            var run = this.runner.run(this.config, {}, done(function (err) {
                assert.equals(err.code, 70);
            }));

            run.abort({});
            deferred.resolve({});
        }
    },

    "uncaught exceptions": {
        setUp: function () {
            this.session = fakeSession(this);
            this.run = testRun.create(fakeConfig(this), {}, this.logger);
        },

        "listens for uncaught exceptions": function () {
            this.run.runTests(this.session);
            this.session.emit("uncaughtException", { data: { message: "Oh" } });

            assert.stderr("Uncaught exception:");
            assert.stderr("Oh");
        },

        "does not listen for uncaught exceptions if already handled": function () {
            this.session.on("uncaughtException", function () {});
            this.run.runTests(this.session);
            this.session.emit("uncaughtException", { data: { message: "Oh" } });

            refute.stderr("Uncaught exception:");
            refute.stderr("Oh");
        },

        "prints uncaught exceptions without colors": function () {
            this.run.runTests(this.session);
            this.session.emit("uncaughtException", { data: { message: "Oh" } });

            var stderr = this.stderr.toString();
            refute.match(this.stderr, "\x1b");
        },

        "prints uncaught exceptions in yellow": function () {
            var run = testRun.create(fakeConfig(this), { color: true }, this.logger);
            run.runTests(this.session);
            this.session.emit("uncaughtException", { data: { message: "Oh" } });

            var stderr = this.stderr.toString();
            assert.equals(stderr.indexOf("\x1b[33mUncaught exception:"), 0);
        },

        "prints uncaught exceptions in bright yellow": function () {
            var run = testRun.create(fakeConfig(this), {
                color: true,
                bright: true
            }, this.logger);
            run.runTests(this.session);
            this.session.emit("uncaughtException", { data: { message: "Oh" } });

            assert.match(this.stderr, "\x1b[1m\x1b[33mUncaught exception:");
        },

        "does not print uncaught exceptions if handled by reporter": "TODO"
    },

    "runSession": {
        setUp: function () {
            this.session = fakeSession(this);
            this.stub(remoteRunner, "create");
        },

        "creates remote runner": function () {
            var run = testRun.create(fakeConfig(this), {}, this.logger);
            this.session.slaves = [{ id: 42 }];

            run.runTests(this.session);

            assert.calledOnce(remoteRunner.create);
            assert.calledWith(remoteRunner.create, this.session, [{ id: 42 }]);
        },

        "failOnNoAssertions should default to true": "TODO",

        "triggers testRun extension hook with runners": function () {
            var config = fakeConfig(this);
            var run = testRun.create(config, {}, this.logger);
            remoteRunner.create.returns({ id: 42 });

            run.runTests(this.session);

            assert.calledOnceWith(
                config.runExtensionHook, "testRun", { id: 42 }, this.session
            );
        },

        //         "aborts run if running extension hook throws": function () {
        //             this.group.runExtensionHook.throws("Oh noes");
        //             this.spy(remoteRunner, "create");
        //             this.runner.runSession(this.session);

        //             assert.calledOnceWith(process.exit, 70);
        //         },

        //         "creates remote runner that does not fail on no assertions": function () {
        //             this.spy(remoteRunner, "create");
        //             this.runner.options.failOnNoAssertions = false;
        //             this.runner.runSession(this.session);

        //             assert.calledWith(
        //                 remoteRunner.create,
        //                 this.session.messagingClient,
        //                 [{id: 1}],
        //                 { failOnNoAssertions: false }
        //             );
        //         },

        //         "creates remote runner that does not auto-run": function () {
        //             this.spy(remoteRunner, "create");
        //             this.runner.options.autoRun = true;
        //             this.runner.runSession(this.session);

        //             assert(remoteRunner.create.args[0][2].autoRun);
        //         },

        //         "creates remote runner with filters": function () {
        //             this.spy(remoteRunner, "create");
        //             this.runner.options.filters = ["1", "2"];
        //             this.runner.runSession(this.session);

        //             assert.equals(remoteRunner.create.args[0][2].filters, ["1", "2"]);
        //         },

        //         "creates remote runner with captureConsole option": function () {
        //             this.spy(remoteRunner, "create");
        //             this.runner.options.captureConsole = true;
        //             this.runner.runSession(this.session);

        //             assert(remoteRunner.create.args[0][2].captureConsole);
        //         },

        //         "with no connected slaves": {
        //             setUp: function () {
        //                 this.runner.callback = this.spy();
        //                 this.spy(remoteRunner, "create");
        //                 this.session.slaves = [];
        //                 this.runner.runSession(this.session);
        //             },

        //             "does not create remote runner": function () {
        //                 refute.called(remoteRunner.create);
        //             },

        //             "prints understandable error": function () {
        //                 assert.match(this.stderr, "No slaves connected, nothing to do");
        //             },

        //             "closes session": function () {
        //                 assert.calledOnce(this.session.close);
        //             },

        //             "does not call done until session closes": function () {
        //                 this.runner.callback = this.spy();
        //                 this.runner.runSession(this.session);

        //                 refute.called(this.runner.callback);
        //             },

        //             "calls callback with error": function () {
        //                 this.close.resolver.resolve();

        //                 assert.calledOnce(this.runner.callback);
        //                 assert.match(this.runner.callback.args[0][0], {
        //                     type: "NoSlavesError",
        //                     code: 76
        //                 });
        //             }
        //         },

        //         "creates progress reporter": function () {
        //             this.spy(progressReporter, "create");

        //             this.runner.runSession(this.session);

        //             assert.calledOnce(progressReporter.create);
        //             assert.match(progressReporter.create.args[0][0], {
        //                 color: false, bright: false
        //             });
        //         },

        //         "should not create progress reporter when providing reporter": function () {
        //             this.spy(progressReporter, "create");
        //             this.spy(reporters.specification, "create");
        //             this.runner.options = { reporter: "specification" };
        //             this.runner.runSession(this.session);

        //             refute.called(progressReporter.create);
        //             assert.calledOnce(reporters.specification.create);
        //         },

        //         "loads reporter using buster-test's loader": function () {
        //             this.spy(reporters, "load");
        //             this.runner.options = { reporter: "dots" };
        //             this.runner.runSession(this.session);

        //             assert.calledOnceWith(reporters.load, "dots");
        //         },

        //         "progress reporter should respect color settings": function () {
        //             this.spy(progressReporter, "create");

        //             this.runner.options = { color: true, bright: true };
        //             this.runner.runSession(this.session);

        //             assert.match(progressReporter.create.args[0][0], {
        //                 color: true, bright: true
        //             });
        //         },

        //         "uses logger as io backend for remote reporter": function () {
        //             this.spy(progressReporter, "create");

        //             this.runner.runSession(this.session);
        //             var io = progressReporter.create.args[0][0].io;
        //             io.print(".");
        //             io.print(".");
        //             io.puts(" OK!");

        //             assert.match(this.stdout, ".. OK!");
        //         },

        //         "adds client on progress reporter when client connects": function () {
        //             var runner = buster.eventEmitter.create();
        //             this.stub(remoteRunner, "create").returns(runner);
        //             this.stub(progressReporter, "addClient");

        //             this.runner.runSession(this.session);
        //             var client = { id: 42 };
        //             runner.emit("client:connect", client);

        //             assert.calledOnce(progressReporter.addClient);
        //             assert.calledWith(progressReporter.addClient, 42, client);
        //         },

        //         "initializes reporter": function () {
        //             this.spy(reporters.dots, "create");

        //             this.runner.runSession(this.session);

        //             assert.match(reporters.dots.create.args[0][0], {
        //                 color: false,
        //                 bright: false,
        //                 displayProgress: false,
        //                 logPassedMessages: false
        //             });
        //         },

        //         "logs messages for passed tests": function () {
        //             this.spy(reporters.dots, "create");

    //             this.runner.options.logPassedMessages = true;
    //             this.runner.runSession(this.session);

    //             assert.match(reporters.dots.create.args[0][0], {
//                 logPassedMessages: true
//             });
        },

//         "initializes reporter with custom properties": function () {
//             this.spy(reporters.dots, "create");

//             this.runner.options = { color: true, bright: true, displayProgress: true };
//             this.runner.runSession(this.session);

//             assert.match(reporters.dots.create.args[0][0], {
//                 color: true, bright: true
//             });
//         },

//         "builds cwd from session server and root": function () {
//             this.runner.server = { hostname: "localhost", port: 1111 };
//             this.session.resourcesPath = "/aaa-bbb/resources";
//             this.spy(reporters.dots, "create");

//             this.runner.runSession(this.session);

//             assert.match(reporters.dots.create.args[0][0], {
//                 cwd: "http://localhost:1111/aaa-bbb/resources"
//             });
//         },

//         "builds cwd from non-default session server and root": function () {
//             this.runner.server = { hostname: "somewhere", port: 2524 };
//             this.session.resourcesPath = "/aaa-ccc/resources";
//             this.spy(reporters.dots, "create");

//             this.runner.runSession(this.session);

//             assert.match(reporters.dots.create.args[0][0], {
//                 cwd: "http://somewhere:2524/aaa-ccc/resources"
//             });
//         },

//         "sets number of contexts in package name": function () {
//             this.spy(reporters.dots, "create");

//             this.runner.runSession(this.session);

//             assert.equals(reporters.dots.create.returnValues[0].contextsInPackageName, 2);
//         },

//         "sets stackFilter.filters": function () {
//             this.runner.runSession(this.session);

//             assert.equals(buster.stackFilter.filters,
//                           ["/buster/bundle-", "buster/wiring",
//                            "buster-capture-server/node_modules"]);
//         },

//         "closes session on suite:end": function () {
//             var runner = buster.eventEmitter.create();
//             this.stub(remoteRunner, "create").returns(runner);

//             this.runner.runSession(this.session);
//             runner.emit("suite:end");

//             assert.calledOnce(this.session.close);
//         },

//         "succesful session close": {
//             setUp: function () {
//                 this.remoteRunner = buster.eventEmitter.create();
//                 this.runner.callback = this.spy();
//                 this.stub(remoteRunner, "create").returns(this.remoteRunner);
//                 this.close.resolver.resolve();
//                 this.runner.runSession(this.session);
//             },

//             "prints to stdout": function () {
//                 var stdout = this.stdout;
//                 this.remoteRunner.emit("suite:end");

//                 refute.equals(this.stdout, stdout);
//             },

//             "calls callback": function () {
//                 this.remoteRunner.emit("suite:end", { ok: true, tests: 42 });

//                 var callback = this.runner.callback;
//                 assert.calledOnceWith(callback, null, { ok: true, tests: 42 });
//             }
//         },

//         "prints to stderr on unsuccesful session close": function () {
//             var runner = buster.eventEmitter.create();
//             this.stub(remoteRunner, "create").returns(runner);
//             this.close.resolver.reject({ message: "Oops" });

//             this.runner.runSession(this.session);
//             var stderr = this.stderr;
//             runner.emit("suite:end");

//             refute.equals(this.stderr, stderr);
//         },

//         "calls done with error on failed session close": function () {
//             var runner = buster.eventEmitter.create();
//             this.stub(remoteRunner, "create").returns(runner);
//             this.runner.callback = this.spy();
//             this.close.resolver.reject({ message: "Oops" });

//             this.runner.runSession(this.session);
//             var stderr = this.stderr;
//             runner.emit("suite:end");

//             assert.calledOnce(this.runner.callback);
//             assert.match(this.runner.callback.args[0][0], {
//                 message: "Failed closing session: Oops",
//                 code: 75,
//                 type: "SessionCloseError"
//             });
//         }
//     },

//     "error handling": {
//         "prints session creation error to stderr": function () {
//             this.config.resolver.resolve();
//             this.runner.run(this.group, this.options);
//             this.session.resolver.reject({
//                 id: 47,
//                 message: "Failed creating session"
//             });

//             assert.match(this.stderr, "Failed creating session");
//         },

//         "prints understandable error if server cannot be reached": function () {
//             this.config.resolver.resolve();
//             this.runner.run(this.group, this.options);
//             this.session.resolver.reject(new Error("ECONNREFUSED, Connection refused"));

//             assert.match(this.stderr, "Unable to connect to server");
//             assert.match(this.stderr, "http://127.0.0.1:1200");
//             assert.match(this.stderr, "Please make sure that buster-server is running");
//         },

//         "calls callback whith error when server cannot be reached": function () {
//             var callback = this.spy();
//             this.config.resolver.resolve();
//             this.runner.run(this.group, this.options, callback);
//             this.session.resolver.reject(new Error("ECONNREFUSED, Connection refused"));

//             assert.calledOnce(callback);
//             assert.match(callback.args[0][0], { code: 75 });
//         },

//         "prints understandable error if pattern matches no files": function () {
//             this.config.resolver.resolve();
//             this.runner.run(this.group, this.options);
//             this.stub(process, "cwd").returns("/home/christian/projects/buster/sample");
//             this.session.resolver.reject(new Error("ENOENT, No such file or directory '/home/christian/projects/buster/sample/src/*.js'"));

//             assert.match(this.stderr, "pattern 'src/*.js' does not match any files");
//         },

//         "calls callback whith error when pattern matches no files": function () {
//             var callback = this.spy();
//             this.config.resolver.resolve();
//             this.runner.run(this.group, this.options, callback);
//             this.stub(process, "cwd").returns("/home/christian/projects/buster/sample");
//             this.session.resolver.reject(new Error("ENOENT, No such file or directory '/home/christian/projects/buster/sample/src/*.js'"));

//             assert.calledOnce(callback);
//             assert.match(callback.args[0][0], { code: 65 });
//         },

//         "prints understandable error if a file could not be found": function () {
//             this.config.resolver.resolve();
//             this.runner.run(this.group, this.options);
//             this.stub(process, "cwd").returns("/home/christian/projects/buster/sample");
//             this.session.resolver.reject(new Error("ENOENT, No such file or directory '/home/christian/projects/buster/sample/src/trim.js'"));

//             assert.match(this.stderr, "Configured path 'src/trim.js' is not a file or directory");
//         },

//         "calls callback whith error when file not found": function () {
//             var callback = this.spy();
//             this.config.resolver.resolve();
//             this.runner.run(this.group, this.options, callback);
//             this.stub(process, "cwd").returns("/home/christian/projects/buster/sample");
//             this.session.resolver.reject(new Error("ENOENT, No such file or directory '/home/christian/projects/buster/sample/src/trim.js'"));

//             assert.calledOnce(callback);
//             assert.match(callback.args[0][0], { code: 65 });
//         },

//         "prints understandable error if config fails to resolve": function () {
//             this.config.resolver.reject({ message: "Failed loading configuration: Oh noes" });
//             this.runner.run(this.group, this.options);

//             assert.match(this.stderr, "Failed loading configuration: Oh noes");
//         },

//         "calls callback whith error when config fails to resolve": function () {
//             var callback = this.spy();
//             this.config.resolver.reject({ message: "Failed loading configuration: Oh noes" });
//             this.runner.run(this.group, this.options, callback);

//             assert.calledOnce(callback);
//             assert.match(callback.args[0][0], { code: 78 });
//         },

//         "calls callback whith error when analyzer precondition fails": function () {
//             var callback = this.spy();
//             this.config.resolver.resolve();
//             this.runner.run(this.group, this.options, callback);
//             this.session.resolver.reject({ name: "AbortedError" });

//             assert.calledOnce(callback);
//             assert.match(callback.args[0][0], { code: 70 });
//         }
//     }
});
