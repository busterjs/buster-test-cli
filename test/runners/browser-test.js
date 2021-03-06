var buster = require("buster-node");
var referee = buster.referee;
var assert = buster.assert;
var refute = buster.refute;
var bane = require("bane");
var streamLogger = require("stream-logger");
var browserRunner = require("../../lib/runners/browser");
var testRun = browserRunner.testRun;
var ramp = require("ramp");
var when = require("when");
var cliHelper = require("buster-cli/test/test-helper");
var remoteRunner = require("../../lib/runners/browser/remote-runner");
var reporters = require("buster-test").reporters;

function mkrs(tc) {
	tc.addResourceDeferred = when.defer();
	var resourceSet = [
	];
	resourceSet.addResource = tc.stub().returns(tc.addResourceDeferred.promise);
	// 4 files means, that one test file exists
	resourceSet.loadPath= {
		paths: tc.stub().returns(4),
		append: tc.stub()
	};

    return resourceSet;
}

function fakeConfig(tc) {
    return bane.createEventEmitter({
        resolve: tc.stub().returns(when.defer().promise),
        runExtensionHook: tc.stub()
    });
}

function fakeSession(tc) {
	tc.initializeDeferred = when.defer();
    return bane.createEventEmitter({
        getSession: tc.stub().returns({
            resourcesPath: ""
        }),
        initialize: tc.stub().returns(tc.initializeDeferred.promise),
        // onStart: tc.stub(),
        // onLoad: tc.stub().yields([{}]),
        // onEnd: tc.stub(),
        // onUnload: tc.stub(),
        onSessionAbort: tc.stub(),
        endSession: tc.stub()
    });
}

function fakeSessionClient(tc) {
    return {
    	getInitialSlaves: tc.stub().returns([1, 2, 3]),
    	endSession: tc.stub()
    };
}

function fakeServerClient(tc) {
    return {
        connect: tc.stub().returns(when()),
        createSession: tc.stub().returns(when(fakeSession(tc)))
    };
}

function testRemoteRunnerOption(options, expected) {
    return function () {
        var run = testRun.create(fakeConfig(this), options, this.logger);
        var actual = run.getClientRunConfig();
        assert.match(actual, expected);
    };
}

buster.testCase("Browser runner", {
    setUp: function () {
        this.stub(process, "on");
        this.runner = Object.create(browserRunner);
        this.stdout = cliHelper.writableStream("stdout");
        this.stderr = cliHelper.writableStream("stderr");
        this.logger = streamLogger(this.stdout, this.stderr);
        this.runner.logger = this.logger;
        this.remoteRunner = bane.createEventEmitter();
        this.remoteRunner.setSlaves = this.spy();
        this.stub(remoteRunner, "create").returns(this.remoteRunner);
    },

    "server client": {
        setUp: function () {
            var client = fakeServerClient(this);
            this.stub(ramp, "createRampClient").returns(client);
        },

        "creates server client": function () {
            this.runner.run(fakeConfig(this), {});

            assert.calledOnce(ramp.createRampClient);
        },

        "creates client for configured location": function () {
            this.runner.run(fakeConfig(this), { server: "http://127.0.0.1:1200" });

            assert.calledWith(ramp.createRampClient, "1200", "127.0.0.1");
        }
    },

    "//session creation": {
        setUp: function () {
            var client = this.serverClient = fakeServerClient(this);
            this.stub(ramp, "createRampClient").returns(this.serverClient);
            this.config = fakeConfig(this);

            referee.add("sessionOptions", {
                assert: function (opts) {
                    this.actual = client.createSession.args[0][1];
                    return referee.match(this.actual, opts);
                },
                assertMessage: "Expected createSession to be called with " +
                    "options ${0}, but was called with ${actual}"
            });
        },

        "not when config is not resolved": function () {
            this.runner.run(this.config, {});

            refute.called(this.serverClient.createSession);
        },

        "not if no matching test files": function () {
            var resourceSet = [
                { path: '/buster/bundle-0.7.js', cacheable: true},
                { path: '/buster/compat-0.7.js', cacheable: true},
                { path: '/buster/capture-server-wiring.js', cacheable: true}
            ];
            this.config.resolve.returns(when(resourceSet));

            this.runner.run(this.config, {
                cacheable: true
            });

            refute.called(this.serverClient.createSession);
        },

        "with configured resource set": function (done) {
            this.config.resolve.returns(when([42]));

            this.runner.run(this.config, {});

            assert.calledOnce(this.serverClient.createSession);
            assert.calledWith(this.serverClient.createSession, [42]);
        },

        "with uncached resource set": function () {
            var resourceSet = [
                { path: "/a.js", cacheable: true },
                { path: "/b.js", cacheable: false },
                { path: "/c.js", cacheable: true }
            ];
            this.config.resolve.returns(when(resourceSet));

            this.runner.run(this.config, {
                cacheable: false
            });

            assert.isFalse(resourceSet[0].cacheable);
            assert.isFalse(resourceSet[1].cacheable);
            assert.isFalse(resourceSet[2].cacheable);
        },

        "with cached resource set": function () {
            var resourceSet = [
                { path: "/a.js", cacheable: true },
                { path: "/c.js", cacheable: true }
            ];
            this.config.resolve.returns(when(resourceSet));

            this.runner.run(this.config, {
                cacheable: true
            });

            assert.isTrue(resourceSet[0].cacheable);
            assert.isTrue(resourceSet[1].cacheable);
        },

        "uses dynamic resource paths by default": function () {
            this.config.resolve.returns(when([{}]));

            this.runner.run(this.config, {});

            assert.sessionOptions({ staticResourcesPath: false });
        },

        "uses static resource paths": function () {
            this.config.resolve.returns(when([{}]));

            this.runner.run(this.config, {
                staticResourcePath: true
            });

            assert.sessionOptions({ staticResourcesPath: false });
        },

        "runs session with testRun object": function () {
            var session = fakeSession(this);
            this.serverClient.createSession.returns(when(session));
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, {});
            this.stub(run, "runTests").yields();
            deferred.resolve([]);

            assert.calledOnce(run.runTests);
            assert.calledWith(run.runTests, session);
        },

        "adds resolved config options to options": function () {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, { id: 42 });
            this.stub(run, "runTests").yields();
            this.config.options = { things: "stuff" };
            deferred.resolve([]);

            assert.equals(run.options, {
                id: 42,
                things: "stuff"
            });
        },

        "calls callback with internally thrown error": function () {
            var callback = this.spy();
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, { id: 42 }, callback);
            this.stub(run, "runTests").throws();

            refute.exception(function () {
                deferred.resolve([]);
            });

            assert.calledOnce(callback);
            assert.defined(callback.args[0][0].message);
        }
    },

    "abort": {
        setUp: function () {
            this.serverClient = fakeServerClient(this);
            this.stub(ramp, "createRampClient").returns(this.serverClient);
            this.config = fakeConfig(this);
        },

        "prevents session creation": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, {}, done(function () {
                refute.called(this.serverClient.createSession);
            }.bind(this)));

            run.abort(new Error("crapsicles"));
            deferred.resolve(mkrs(this));
        },

        "calls run-callback with abort error": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, {}, done(function (err) {
                assert.equals(err.code, 42);
            }));

            run.abort({ code: 42 });
            deferred.resolve(mkrs(this));
        },

        "sets error code if not present": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var run = this.runner.run(this.config, {}, done(function (err) {
                assert.equals(err.code, 70);
            }));

            run.abort({});
            deferred.resolve(mkrs(this));
        },

        "does not start a test run": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var runTestsSpy, onInterruptSpy;
            var run = this.runner.run(this.config, {}, function () {
                setTimeout(done(function () {
                    refute.called(runTestsSpy);
                    refute.called(onInterruptSpy);
                }), 10);
            });
            runTestsSpy = this.spy(run, "runTests");
            onInterruptSpy = this.spy(run, "onInterrupt");

            run.abort({ code: 42 });
            deferred.resolve(mkrs(this));
        },

        "does not send resources to browser": function (done) {
            var deferred = when.defer();
            this.config.resolve.returns(deferred.promise);

            var resourceSet = mkrs(this);

            var run = this.runner.run(this.config, {}, function () {
                setTimeout(done(function () {
                    refute.called(resourceSet.addResource);
                }), 10);
            });

            run.abort({ code: 42 });
            deferred.resolve(resourceSet);
        },

        "ends session if running": function (done) {
            this.config.resolve.returns(when.resolve(mkrs(this)));

            var session = fakeSession(this);

            var run = this.runner.run(this.config, {}, function (err) {
                assert.match(err, { message: "crapola" });
                setTimeout(done(function () {
                    assert.calledOnce(session.endSession);
                }), 10);
            });

            // note: stubbing own methods... but there's no other way to intercept currently
            // so doing it anyways, since we need to document the use case via test name...
            this.stub(run, "startSession", function (client, cb) {
                return function () {
                    run.abort(new Error("crapola"));
                    // bypass serverClient.createSession - imagine it just worked
                    cb(null, session);
                }
            });
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

    "runTests": {
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
            "triggers with runners": function (done) {
                var config = fakeConfig(this);
                var sessionClient = fakeSessionClient(this);
                this.initializeDeferred.resolve(sessionClient);
                var run = testRun.create(config, {}, this.logger);

                run.runTests(this.session);

                this.initializeDeferred.promise.then(function () {
                    assert.called(config.runExtensionHook);
                    assert.calledWith(
                        config.runExtensionHook,
                        "testRun",
                        this.remoteRunner,
                        sessionClient
                    );
                    done();
                }.bind(this));
            },

            "aborts run when hook throws": function (done) {
                var config = fakeConfig(this);
                config.runExtensionHook.throws(new Error("Oh noes"));
                var run = testRun.create(config, {}, this.logger);

                run.runTests(this.session, function (err) {
                    assert.equals(err.code, 70);
                    assert.calledOnce(this.session.endSession);
                    done();
                }.bind(this));
            }
        },

        "//remote runner": {
            "creates remote runner with slaves": function () {
                this.stub(remoteRunner, "setSlaves");
                var run = testRun.create(fakeConfig(this), {}, this.logger);
                this.session.onLoad.yields([{ id: 42 }]);

                run.runTests(this.session);

                assert.calledOnce(remoteRunner.create);
                assert.calledWith(remoteRunner.create, this.session);
                assert.calledOnce(this.remoteRunner.setSlaves);
                assert.calledWith(this.remoteRunner.setSlaves, [{ id: 42 }]);
            }
        },

        "remote configuration": {
            "defaults failOnNoAssertions to true": testRemoteRunnerOption({}, {
                failOnNoAssertions: true
            }),

            "configures to not fail on no assertions": testRemoteRunnerOption({
                failOnNoAssertions: false
            }, {
                failOnNoAssertions: false
            }),

            "defaults auto-run to true": testRemoteRunnerOption({}, { autoRun: true }),

            "configures to not auto-run": testRemoteRunnerOption({
                autoRun: false
            }, {
                autoRun: false
            }),

            "auto-run": {
                "defaults to true": testRemoteRunnerOption({}, { autoRun: true }),
                "overrides to not auto-run via options": testRemoteRunnerOption({ autoRun: false }, { autoRun: false }),
                "overrides to not auto-run via config": function () {
                    // this tests that we can have autoRun: false in buster.js config file
                    var run = testRun.create(fakeConfig(this), {}, this.logger);
                    run.config = {
                        autoRun: false
                    };

                    var actual = run.getClientRunConfig();
                    refute(actual.autoRun);
                },
                "overrides to not auto-run via config.options": function () {
                    // this tests that buster-amd can set conf.options.autoRun = false during its configure() phase
                    // this also checks that run.config.options is merged into run.options
                    var run = testRun.create(fakeConfig(this), { autoRun: true }, this.logger);
                    run.config = {
                        options: {
                            autoRun: false
                        }
                    };

                    var actual = run.getClientRunConfig();
                    refute(actual.autoRun); // config.options.autoRun - not options.autoRun
                },
                "config.autoRun more important than config.options.autoRun": function () {
                    var run = testRun.create(fakeConfig(this), {}, this.logger);
                    run.config = {
                        autoRun: false,
                        options: {
                            autoRun: true
                        }
                    };

                    var actual = run.getClientRunConfig();
                    refute(actual.autoRun); // config.autoRun - not config.options.autoRun
                }
            },

            "defaults filters to undefined": function () {
                // "pretty" implementation needs https://github.com/busterjs/samsam/pull/9
                // "defaults filters to undefined": testRemoteRunnerOption({}, {
                //    filters: undefined
                // }),

                var run = testRun.create(fakeConfig(this), {}, this.logger);
                var actual = run.getClientRunConfig();
                refute.defined(actual.filters);
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
            }),

            "allows focus rockets by default": testRemoteRunnerOption({}, {
                allowFocusMode: true
            }),

            "configures to ground space flight": testRemoteRunnerOption({
                allowFocusMode: false
            }, {
                allowFocusMode: false
            })
        },

        "//with no connected slaves": {
            setUp: function () {
                this.session.onLoad.yields([]);
                this.run = testRun.create(fakeConfig(this), {}, this.logger);
            },

            "does not set remote runner slaves": function () {
                this.run.runTests(this.session, function () {});
                refute.called(this.remoteRunner.setSlaves);
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

            "//ends session": function () {
                this.run.runTests(this.session, function () {});
                assert.calledOnce(this.session.end);
            },

            "//does not call done until session closes":
            "TODO: session.end is currently not async. augustl?"
        },

        "reporter": {
            setUp: function () {
                this.spy(reporters.brief, "create");
            },

            "defaults to brief reporter": function () {
                var run = this.createRun();
                run.runTests(this.session);

                assert.calledOnce(reporters.brief.create);
                assert.match(reporters.brief.create.args[0][0], {
                    color: false,
                    bright: false
                });
            },

            "loads reporter using buster-test's loader": function () {
                this.spy(reporters, "load");
                var run = this.createRun({ reporter: "brief" });
                run.runTests(this.session);

                assert.calledOnceWith(reporters.load, "brief");
            },

            "uses logger as output stream": function () {
                var run = this.createRun();
                run.runTests(this.session);
                var ostream = reporters.brief.create.args[0][0].outputStream;
                ostream.write(".");
                ostream.write(".");
                ostream.write(" OK!");

                assert.stdout(".. OK!");
            },

            "initializes reporter": function () {
                var run = this.createRun();
                run.runTests(this.session);

                assert.match(reporters.brief.create.args[0][0], {
                    color: false,
                    bright: false,
                    displayProgress: false,
                    logPassedMessages: false
                });
            },

            "logs messages for passed tests": function () {
                var run = this.createRun({ logPassedMessages: true });
                run.runTests(this.session);

                assert.match(reporters.brief.create.args[0][0], {
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

                assert.match(reporters.brief.create.args[0][0], {
                    color: true,
                    bright: true
                });
            },

            "builds cwd from session server and root": function () {
                this.session.getSession = this.stub().returns({
                    resourcesPath: "/aaa-bbb/resources"
                });
                var run = this.createRun({ server: "localhost:1111" });
                run.runTests(this.session);

                assert.match(reporters.brief.create.args[0][0], {
                    stackFilter: {
                        cwd: "http://localhost:1111/aaa-bbb/resources"
                    }
                });
            },

            "builds cwd from non-default session server and root": function () {
                this.session.getSession = this.stub().returns({
                    resourcesPath: "/aaa-bbb/resources"
                });
                var run = this.createRun({ server: "somewhere:2524" });
                run.runTests(this.session);

                assert.match(reporters.brief.create.args[0][0], {
                    stackFilter: {
                        cwd: "http://somewhere:2524/aaa-bbb/resources"
                    }
                });
            },

            "sets number of contexts in package name": function () {
                var run = this.createRun();
                run.runTests(this.session);

                var reporter = reporters.brief.create.returnValues[0];
                assert.equals(reporter.contextsInPackageName, 2);
            },

            "makes reporter listen for events from runner": function () {
                this.stub(reporters.brief, "listen");
                var run = this.createRun();
                run.runTests(this.session);

                assert.calledOnce(reporters.brief.listen);
                assert.calledWith(reporters.brief.listen, this.remoteRunner);
            }
        },
        "beforeRun extension hook": {

            setUp: function () {
                this.run = this.createRun();
                this.config = this.run.config;
            },

            "triggers beforeRun": function () {
                this.run.runTests(this.session, function () {});
                assert.called(this.config.runExtensionHook);
                assert.calledWith(this.config.runExtensionHook, "beforeRun");
            },

            "aborts if beforeRun hook throws": function () {
                this.config.runExtensionHook.throws();
                this.run.runTests(this.session, function () {});

                assert.called(this.session.endSession);
                refute.called(this.session.initialize);
            },

            "calls callback if beforeRun hook throws": function () {
                var callback = this.spy();
                this.config.runExtensionHook.throws();
                this.run.runTests(this.session, callback);

                assert.called(callback);
            }
        },

        "closing session": {
            setUp: function () {
                this.run = this.createRun();

                // Avoid having actual reporters printing to STDOUT
                this.stub(reporters, "load").returns({
                    create: this.stub().returns({ listen: this.stub() })
                });
                this.sessionClient = fakeSessionClient(this);
                this.initializeDeferred.resolve(this.sessionClient);
            },

            "ends session client on suite:end": function (done) {
                this.run.runTests(this.session, function () {
                    assert.calledOnce(this.sessionClient.endSession);
                    done();
                }.bind(this));
                this.initializeDeferred.promise.then(function () {
                    this.remoteRunner.emit("suite:end");
                }.bind(this));
            },

            "prints to stdout": function () {
                var stdout = this.stdout.toString();
                this.run.endSession(this.session);

                refute.equals(this.stdout, stdout);
            },

            "does not throw when no session provided": function () {
                // note: this should not be necessary! but it avoids hidden exceptions
                // after the abort() happens
                this.run.endSession();
                assert(true);
            },

            "calls run callback when done": function (done) {
                this.run.runTests(this.session, function (err, res) {
                    assert.isNull(err);
                    assert.equals(res, {ok: true});
                    done();
                });
                this.initializeDeferred.promise.then(function () {
                    this.remoteRunner.emit("suite:end", {ok: true});
                }.bind(this));
            },

            "prints to stderr on unsuccesful session close":
            "TODO: session.end is not currently async",

            "calls done with error on failed session close":
            "TODO: session.end is not currently async. Should fail with code 75"
        }
    },

    "error handling": {
        setUp: function () {
            this.run = testRun.create(fakeConfig(this), {
                server: "localhost:1111"
            }, this.logger);
            this.sessionDeferred = when.defer();
            this.client = {
                connect: this.stub().returns(when()),
                createSession: this.stub().returns(this.sessionDeferred.promise)
            };
        },

        "session preparation error": function (done) {
            this.stub(ramp, "createRampClient").returns({
                connect: this.stub().returns(when({}))
            });
            var config = fakeConfig(this);
            config.resolve.returns(when({}));
            var options = { server: "localhost:1111" };

            var cb = done(function (err) {
                assert.match(err.message, "serializing");
            });

            this.run = testRun.create(config, options, this.logger, cb);
            this.run.startSession = function (client, callback) {
                return function () {
                    callback({ message: "Failed serializing resources" });
                };
            };
            this.run.start();
        },

        "session creation error": function (done) {
            var resourceSet = mkrs(this);
            this.addResourceDeferred.resolve();
            this.sessionDeferred.reject({message: "Djeez"});

            this.run.startSession(this.client, function (err) {
                assert.match(err.message, "Failed creating session");
                done();
            })(resourceSet);
        },

        "yields understandable error if server cannot be reached": function (done) {
            var resourceSet = mkrs(this);
            this.addResourceDeferred.resolve();
            this.sessionDeferred.reject(new Error("ECONNREFUSED, Connection refused"));

            this.run.startSession(this.client, function (err) {
                var message = err.message;
                assert.match(message, "Unable to connect to server");
                assert.match(message, "http://localhost:1111");
                assert.match(message, "Please make sure that buster-server is running");
                assert.equals(err.code, 75);
                done();
            })(resourceSet);
        },

        "passes on the error message received in session abort": function (done) {

            this.stub(ramp, "createRampClient").returns(this.client);

            var session = fakeSession(this);
            var config = fakeConfig(this);
            config.resolve = this.stub().returns(when.resolve(mkrs(this)));

            this.run = testRun.create(config, { server: "localhost:1111" }, this.logger, function (err) {
                assert.equals(err.message, "not sure what happened");
                assert.calledOnce(session.endSession);
                done();
            });

            this.stub(this.run, "runTests", function () {
                // instead of running tests - abort the session
                // this is ugly as hell...
                assert.calledOnce(session.onSessionAbort);
                var listener = session.onSessionAbort.firstCall.args[0];
                listener({error: "not sure what happened"});
            });

            this.run.start();

            this.addResourceDeferred.resolve();
            this.sessionDeferred.resolve(session);
        },

        "adds default error message for session abort": function (done) {

            this.stub(ramp, "createRampClient").returns(this.client);

            var session = fakeSession(this);
            var config = fakeConfig(this);
            config.resolve = this.stub().returns(when.resolve(mkrs(this)));

            this.run = testRun.create(config, { server: "localhost:1111" }, this.logger, function (err) {
                assert.equals(err.message, "Browser session aborted (client failed to send a heartbeat?)");
                done();
            });

            this.stub(this.run, "runTests", function () {
                // instead of running tests - abort the session
                // this is ugly as hell...
                assert.calledOnce(session.onSessionAbort);
                var listener = session.onSessionAbort.firstCall.args[0];
                listener({}); // emulate ramp calling back without any details
            });

            this.run.start();

            this.addResourceDeferred.resolve();
            this.sessionDeferred.resolve(session);
        },

        "files": {
            setUp: function () {
                this.stub(ramp, "createRampClient").returns(this.client);
                this.config = fakeConfig(this);
                this.configDeferred = when.defer();
                this.config.resolve.returns(this.configDeferred.promise);
                this.stub(process, "cwd").returns("/home/christian/projects/buster/sample");
            },

            "yields understandable error if pattern matches no files": function (done) {
                this.configDeferred.reject(new Error("ENOENT, No such file or directory '/home/christian/projects/buster/sample/src/*.js'"));

                var run = testRun.create(this.config, {}, this.logger, function (err) {
                    assert.match(err.message, "pattern 'src/*.js' does not match any files");
                    assert.equals(err.code, 65);
                    done();
                });
                run.start();
            },

            "yields understandable error if a file could not be found": function (done) {
                this.configDeferred.reject(new Error("ENOENT, No such file or directory '/home/christian/projects/buster/sample/src/trim.js'"));

                var run = testRun.create(this.config, {}, this.logger, function (err) {
                    assert.match(err.message, "Configured path 'src/trim.js' is not a file or directory");
                    assert.equals(err.code, 65);
                    done();
                });
                run.start();
            },

            "yields understandable error if config fails to resolve": function (done) {
                this.configDeferred.reject({ message: "Failed loading configuration: Oh noes" });

                var run = testRun.create(this.config, {}, this.logger, function (err) {
                    assert.match(err.message, "Failed loading configuration: Oh noes");
                    done();
                });
                run.start();
            }
        }
    }
});
