var buster = require("buster");
var stdioLogger = require("buster-stdio-logger");
var browserRunner = require("../../lib/runners/browser");
var captureServer = require("buster-capture-server");
var when = require("when");
// var busterClient = require("buster-client").client;
// var remoteRunner = require("../../lib/runners/browser/remote-runner");
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
        this.runner.logger = { info: this.spy() };
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
            this.runner.cacheable = true;
            this.config.resolve.returns(when({ id: 42 }));

            this.runner.run(this.config, {}, done(function () {
                assert.sessionOptions({ cache: true });
            }.bind(this)));
        },

        "skips resource cache when uncacheable": function (done) {
            this.runner.cacheable = false;
            this.config.resolve.returns(when({}));

            this.runner.run(this.config, {}, done(function () {
                assert.sessionOptions({ cache: false });
            }.bind(this)));
        },

        "caches resources when becoming cacheable while running": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);
            this.runner.cacheable = false;

            this.runner.run(this.config, {}, done(function () {
                assert.sessionOptions({ cache: true });
            }.bind(this)));

            this.runner.cacheable = true;
            deferred.resolve({});
        },

        "skips caching when becoming cacheable while running": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);
            this.runner.cacheable = true;

            this.runner.run(this.config, {}, done(function () {
                assert.sessionOptions({ cache: false });
            }.bind(this)));

            this.runner.cacheable = false;
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

        "runs session with runSession": function (done) {
            var session = { id: 42 };
            this.serverClient.createSession.returns(when(session));
            this.stub(this.runner, "runSession").yields();
            this.config.resolve.returns(when({}));

            this.runner.run(this.config, {}, done(function () {
                assert.calledOnce(this.runner.runSession);
                assert.calledWith(this.runner.runSession, session);
            }.bind(this)));
        },

        "runs session with all options": function (done) {
            this.stub(this.runner, "runSession").yields();
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            this.runner.run(this.config, { id: 42 }, done(function () {
                assert.equals(this.runner.runSession.args[0][1], {
                    id: 42,
                    things: "stuff"
                });
            }.bind(this)));

            this.config.options = { things: "stuff" };
            deferred.resolve({});
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

            this.runner.run(this.config, {}, done(function () {
                refute.called(this.serverClient.createSession);
            }.bind(this)));

            this.runner.abort();
            deferred.resolve({});
        },

        "ends session if running": function (done) {
            this.config.resolve.returns(when({}));
            var session = { end: this.spy() };
            var deferred = when.defer();
            deferred.promise.id = 42;
            this.serverClient.createSession.returns(deferred.promise);

            this.runner.run(this.config, {}, function () {
                process.nextTick(done(function () {
                    assert.calledOnce(session.end);
                }));
            });

            this.runner.abort();
            deferred.resolve(session);
        },

        "calls run-callback with abort error": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred);

            this.runner.run(this.config, {}, done(function (err) {
                assert.equals(err.code, 42);
            }));

            this.runner.abort({ code: 42 });
            deferred.resolve({});
        },

        "sets error code if not present": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred);

            this.runner.run(this.config, {}, done(function (err) {
                assert.equals(err.code, 70);
            }));

            this.runner.abort({});
            deferred.resolve({});
        }
    },

    "runSession": {
        setUp: function () {
            this.session = fakeSession(this);
        },

        //     "session": {
        //         setUp: function () {
        //             this.session = buster.eventEmitter.create();
        //             this.session.onMessage = function () {};
        //             this.session.messagingClient = this.session;
        //             this.session.slaves = [{ id: 1 }];
        //             this.close = when.defer();
        //             this.session.close = this.stub().returns(this.close.promise);
        //             this.stackFilter = buster.stackFilter.filters;
        //             this.runner.config = this.group;

        //             this.emitSessionMessage = function (event, data) {
        //                 this.session.emit(event, { data: data });
        //             };

        //             this.stub(process, "exit");
        //         },

        //         tearDown: function () {
        //             buster.stackFilter.filters = this.stackFilter;
        //         },

        "does not listen for uncaught exceptions with dots reporter": function () {
            this.runner.runSession(this.session, {}, function () {});

            this.emitSessionMessage("uncaughtException", { message: "Oh noes" });

            refute.match(this.stderr, "Uncaught exception:");
        },

        //         "listens for uncaught exceptions": function () {
        //             this.runner.options.reporter = "specification";
        //             this.runner.runSession(this.session);

        //             this.emitSessionMessage("uncaughtException", { message: "Oh noes" });

        //             assert.match(this.stderr, "Uncaught exception:");
        //             assert.match(this.stderr, "Oh noes");
        //         },

        //         "creates remote runner": function () {
        //             this.spy(remoteRunner, "create");
        //             this.runner.runSession(this.session);

        //             assert.calledOnce(remoteRunner.create);
        //             assert.calledWith(remoteRunner.create,
        //                               this.session.messagingClient, [{id: 1}], {
        //                                   failOnNoAssertions: true
        //                               });
        //         },

        //         "triggers testRun extension hook with runners": function () {
        //             this.spy(remoteRunner, "create");
        //             this.runner.runSession(this.session);

        //             assert.calledOnce(this.group.runExtensionHook);
        //             assert.calledOnceWith(this.group.runExtensionHook,
        //                                   "testRun",
        //                                   remoteRunner.create.getCall(0).returnValue,
        //                                   this.session.messagingClient);
        //         },

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
