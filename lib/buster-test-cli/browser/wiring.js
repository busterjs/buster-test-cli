/*jslint browser: true*/
(function (B) {
    function catchUncaughtErrors(emitter) {
        window.onerror = function (message) {
            emitter.emit("uncaughtException", {
                name: "UncaughtError",
                message: message
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

    function cleanEnvironment(runner) {
        var scripts = document.body.getElementsByTagName("script"), script;
        while ((script = scripts[0])) {
            script.parentNode.removeChild(script);
        }

        var env = buster.browserEnv.create(document.body);
        env.listen(runner);
    }

    function connectTestRunner(emitter) {
        var ctxts = collectTestCases();
        var ready, started, config;

        function startRun() {
            if (!ready || !started) { return; }
            var runner = B.testRunner.create(config);
            var reporter = B.reporters.jsonProxy.create(emitter);
            reporter.listen(runner);
            cleanEnvironment(runner);
            runner.runSuite(buster.testContext.compile(ctxts, config.filters));
        }

        emitter.on("tests:run", function (msg) {
            var data = (msg && msg.data) || {};
            config = data;
            ready = true;
            var autoRun = !data.hasOwnProperty("autoRun") || data.autoRun;
            started = started || autoRun;
            startRun();
        });

        return function () {
            started = true;
            startRun();
        };
    }

    B.configureTestClient = function (emitter) {
        var ready, connected;

        function emitReady() {
            if (ready && connected) {
                emitter.emit("ready", navigator.userAgent);
                emitReady = function () {};
            }
        }

        B.ready = function () {
            ready = true;
            emitReady();
        };

        emitter.connect(function () {
            connected = true;
            emitReady(emitter);
        });

        catchUncaughtErrors(emitter);
        connectLogger(emitter);
        B.run = connectTestRunner(emitter);

        B.env = B.env || {};
        B.env.path = window.location.href;
    };

    if (B.publish && B.subscribe) {
        var emitter = B.bayeuxEmitter.create(B, {
            id: buster.env.id
        });
        B.emit = B.bind(emitter, "emit");
        B.on = B.bind(emitter, "on");
        B.configureTestClient(emitter);
    }

    // TMP Performance fix
    (function () {
        var i = 0;

        B.nextTick = function (cb) {
            i += 1;

            if (i === 10) {
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
