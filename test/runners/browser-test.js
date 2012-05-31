var buster = require("buster");
var stdioLogger = require("buster-stdio-logger");
var browserRunner = require("../../lib/runners/browser");
var testRun = browserRunner.testRun;
var captureServer = require("buster-capture-server");
var when = require("when");
var cliHelper = require("buster-cli/lib/test-helper");
var remoteRunner = require("../../lib/runners/browser/remote-runner");
var progressReporter = require("../../lib/runners/browser/progress-reporter");
var reporters = require("buster-test").reporters;

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
        onUnload: tc.stub(),
        slaves: [{}],
        end: tc.stub()
    });
}

function fakeServerClient(tc) {
    return {
        createSession: tc.stub().returns(when(fakeSession(tc)))
    };
}

function testRemoteRunnerOption(options, expected) {
    return function () {
        options = options || {};
        var run = testRun.create(fakeConfig(this), options, this.logger);

        run.runTests(this.session);

        var actual = remoteRunner.create.args[0][2];
        assert.match(actual, expected);
    };
}

buster.testCase("Browser runner", {
    setUp: function () {
        this.runner = buster.create(browserRunner);
        this.stdout = cliHelper.writableStream("stdout");
        this.stderr = cliHelper.writableStream("stderr");
        this.logger = stdioLogger(this.stdout, this.stderr);
        this.runner.logger = this.logger;
        this.remoteRunner = buster.eventEmitter.create();
        this.stub(remoteRunner, "create").returns(this.remoteRunner);
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

        "with configured resource set": function () {
            this.config.resolve.returns(when({ id: 42 }));

            this.runner.run(this.config, {});

            assert.calledOnce(this.serverClient.createSession);
            assert.calledWith(this.serverClient.createSession, { id: 42 });
        },

        "caches resources when cacheable": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, {});
            run.cacheable = true;
            deferred.resolve({});

            deferred.then(done(function () {
                assert.sessionOptions({ cache: true });
            }));
        },

        "skips caching when uncacheable": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, {});
            run.cacheable = false;
            deferred.resolve({});

            deferred.then(done(function () {
                assert.sessionOptions({ cache: false });
            }));
        },

        "is unjoinable": function () {
            this.config.resolve.returns(when({ id: 42 }));

            this.runner.run(this.config, {});

            assert.sessionOptions({ joinable: false });
        },

        "uses dynamic resource paths by default": function () {
            this.config.resolve.returns(when({ id: 42 }));

            this.runner.run(this.config, {});

            assert.sessionOptions({ staticResourcesPath: false });
        },

        "uses static resource paths": function () {
            this.config.resolve.returns(when({ id: 42 }));

            this.runner.run(this.config, {
                staticResourcePath: true
            });

            assert.sessionOptions({ staticResourcesPath: false });
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
            this.createRun = function (options) {
                return testRun.create(
                    fakeConfig(this),
                    options || {},
                    this.logger
                );
            };
        },

        "testRun extension hook": {
            "triggers with runners": function () {
                var config = fakeConfig(this);
                var run = testRun.create(config, {}, this.logger);

                run.runTests(this.session);

                assert.calledOnceWith(
                    config.runExtensionHook,
                    "testRun",
                    this.remoteRunner,
                    this.session
                );
            },

            "aborts run when hook throws": function () {
                var config = fakeConfig(this);
                config.runExtensionHook.throws("Oh noes");
                var run = testRun.create(config, {}, this.logger);

                run.runTests(this.session, function (err) {
                    assert.equals(err.code, 70);
                });
            }
        },

        "remote runner": {
            "creates remote runner": function () {
                var run = testRun.create(fakeConfig(this), {}, this.logger);
                this.session.slaves = [{ id: 42 }];

                run.runTests(this.session);

                assert.calledOnce(remoteRunner.create);
                assert.calledWith(remoteRunner.create, this.session, [{ id: 42 }]);
            },

            "defaults failOnNoAssertions to true": testRemoteRunnerOption({}, {
                failOnNoAssertions: true
            }),

            "configures to not fail on no assertions": testRemoteRunnerOption({
                failOnNoAssertions: false
            }, {
                failOnNoAssertions: false
            }),

            "defaults auto-run to true": testRemoteRunnerOption({}, {
                autoRun: true
            }),

            "configures to not auto-run": testRemoteRunnerOption({
                autoRun: false
            }, {
                autoRun: false
            }),

            "defaults filters to null": function () {
                var run = testRun.create(fakeConfig(this), {}, this.logger);

                run.runTests(this.session);

                refute.defined(remoteRunner.create.args[0][2].filters);
            },

            "includes filters": testRemoteRunnerOption({
                filters: ["1", "2"]
            }, {
                filters: ["1", "2"]
            }),

            "captures console by default": testRemoteRunnerOption({}, {
                captureConsole: true
            }),

            "configures to not capture console": testRemoteRunnerOption({
                captureConsole: false
            }, {
                captureConsole: false
            })
        },

        "with no connected slaves": {
            setUp: function () {
                this.session.slaves = [];
                this.run = testRun.create(fakeConfig(this), {}, this.logger);
            },

            "does not create remote runner": function () {
                this.run.runTests(this.session);
                refute.called(remoteRunner.create);
            },

            "generates understandable error": function (done) {
                this.run.runTests(this.session, done(function (err) {
                    assert.match(err, {
                        message: "No slaves connected, nothing to do",
                        type: "NoSlavesError",
                        code: 76
                    });
                }));
            },

            "ends session": function () {
                this.run.runTests(this.session);
                assert.calledOnce(this.session.end);
            },

            "//does not call done until session closes":
            "TODO: session.end is currently not async. augustl?"
        },

        "reporter": {
            setUp: function () {
                this.spy(progressReporter, "create");
                this.spy(reporters.dots, "create");
            },

            "defaults to progress reporter": function () {
                var run = this.createRun();
                run.runTests(this.session);

                assert.calledOnce(progressReporter.create);
                assert.match(progressReporter.create.args[0][0], {
                    color: false,
                    bright: false
                });
            },

            "skips progress reporter when providing reporter": function () {
                this.spy(reporters.specification, "create");
                var run = this.createRun({ reporter: "specification" });
                run.runTests(this.session);

                refute.called(progressReporter.create);
                assert.calledOnce(reporters.specification.create);
            },

            "loads reporter using buster-test's loader": function () {
                this.spy(reporters, "load");
                var run = this.createRun({ reporter: "dots" });
                run.runTests(this.session);

                assert.calledOnceWith(reporters.load, "dots");
            },

            "progress reporter should respect color settings": function () {
                var run = this.createRun({ color: true, bright: true });
                run.runTests(this.session);

                assert.match(progressReporter.create.args[0][0], {
                    color: true,
                    bright: true
                });
            },

            "uses logger as output stream for remote reporter": function () {
                var run = this.createRun();
                run.runTests(this.session);
                var ostream = progressReporter.create.args[0][0].outputStream;
                ostream.write(".");
                ostream.write(".");
                ostream.write(" OK!");

                assert.stdout(".. OK!");
            },

            "adds client on progress reporter when client connects": function () {
                this.stub(progressReporter, "addClient");

                var run = this.createRun();
                run.runTests(this.session);
                var client = { id: 42 };
                this.remoteRunner.emit("client:connect", client);

                assert.calledOnce(progressReporter.addClient);
                assert.calledWith(progressReporter.addClient, 42, client);
            },

            "initializes reporter": function () {
                var run = this.createRun();
                run.runTests(this.session);

                assert.match(reporters.dots.create.args[0][0], {
                    color: false,
                    bright: false,
                    displayProgress: false,
                    logPassedMessages: false
                });
            },

            "logs messages for passed tests": function () {
                var run = this.createRun({ logPassedMessages: true });
                run.runTests(this.session);

                assert.match(reporters.dots.create.args[0][0], {
                    logPassedMessages: true
                });
            },

            "initializes reporter with custom properties": function () {
                var run = this.createRun({
                    color: true,
                    bright: true,
                    displayProgress: true
                });
                run.runTests(this.session);

                assert.match(reporters.dots.create.args[0][0], {
                    color: true,
                    bright: true
                });
            },

            "builds cwd from session server and root": function () {
                this.session.resourcesPath = "/aaa-bbb/resources";
                var run = this.createRun({ server: "localhost:1111" });
                run.runTests(this.session);

                assert.match(reporters.dots.create.args[0][0], {
                    cwd: "http://localhost:1111/aaa-bbb/resources"
                });
            },

            "builds cwd from non-default session server and root": function () {
                this.session.resourcesPath = "/aaa-bbb/resources";
                var run = this.createRun({ server: "somewhere:2524" });
                run.runTests(this.session);

                assert.match(reporters.dots.create.args[0][0], {
                    cwd: "http://somewhere:2524/aaa-bbb/resources"
                });
            },

            "sets number of contexts in package name": function () {
                var run = this.createRun();
                run.runTests(this.session);

                var reporter = reporters.dots.create.returnValues[0];
                assert.equals(reporter.contextsInPackageName, 2);
            }
        },

        "closing session": {
            setUp: function () {
                this.run = this.createRun();
            },

            "ends session on suite:end": function () {
                this.run.runTests(this.session);
                this.remoteRunner.emit("suite:end");

                assert.calledOnce(this.session.end);
            },

            "prints to stdout": function () {
                var stdout = this.stdout.toString();
                this.run.endSession(this.session);

                refute.equals(this.stdout, stdout);
            },

            "calls run callback when done": function (done) {
                var stdout = this.stdout.toString();

                this.run.runTests(this.session, done(function () {
                    refute.equals(this.stdout, stdout);
                }.bind(this)));

                this.remoteRunner.emit("suite:end");
            }
        }
    },


//         },

//         "prints to stderr on unsuccesful session close": function () {
//             var runner = buster.eventEmitter.create();
//             this.stub(remoteRunner, "create").returns(runner);
//             this.close.resolver.reject({ message: "Oops" });

//        run.runTests
//             var stderr = this.stderr;
//             runner.emit("suite:end");

//             refute.equals(this.stderr, stderr);
//         },

//         "calls done with error on failed session close": function () {
//             var runner = buster.eventEmitter.create();
//             this.stub(remoteRunner, "create").returns(runner);
//             this.runner.callback = this.spy();
//             this.close.resolver.reject({ message: "Oops" });

//       run.runTests(thithis.run.runTests          var stderr = this.stderr;
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
