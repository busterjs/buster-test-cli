(function (B) {
    function catchUncaughtErrors(emitter) {
        window.onerror = function (message) {
            emitter.emit("uncaughtException", {
                name: "UncaughtError", message: message
            });

            return true;
        };
    }

    function connectLogger(emitter) {
        B.console.on("log", function (msg) {
            emitter.emit("log", msg);
        });
    }

    function collectTestCases() {
        var contexts = [];
        B.addTestContext = function (context) { contexts.push(context); };
        B.testCase.onCreate = B.addTestContext;
        B.spec.describe.onCreate = B.addTestContext;

        return contexts;
    }

    // Some test contexts may not be ready to run at create time
    // Make sure these get parsed before running them
    function parsedContexts(testContexts) {
        var ctxs = [];

        for (var i = 0, l = testContexts.length; i < l; ++i) {
            if (!testContexts[i].tests &&
                typeof testContexts[i].parse == "function") {
                ctxs.push(testContexts[i].parse());
            } else {
                ctxs.push(testContexts[i]);
            }
        }

        return ctxs;
    }

    function connectTestRunner(emitter) {
        var contexts = collectTestCases();

        emitter.on("tests:run", function (msg) {
            var runner = B.testRunner.create(msg.data);
            var reporter = B.reporters.jsonProxy.create(emitter);
            reporter.listen(runner);
            runner.runSuite(parsedContexts(contexts));
        });
    }

    B.configureTestClient = function (emitter) {
        var ready = false, started = false;

        function emitReady() {
            if (started && ready) {
                emitter.emit("ready", navigator.userAgent);
                emitReady = function () {};
            }
        }

        B.run = function () {
            started = true;
            emitReady();
        };

        emitter.connect(function () {
            ready = true;
            emitReady(emitter);
        });

        catchUncaughtErrors(emitter);
        connectLogger(emitter);
        connectTestRunner(emitter);

        B.env = B.env || {};
        B.env.path = window.location.href;
    };

    if (B.publish && B.subscribe) {
        B.configureTestClient(B.bayeuxEmitter.create(B));
    }

    // TMP Performance fix
    (function () {
        var i = 0;

        B.nextTick = function (cb) {
            i += 1;

            if (i == 10) {
                setTimeout(function () {
                    cb();
                }, 0);

                i = 0;
            } else {
                cb();
            }
        };
    }());
}(buster));
