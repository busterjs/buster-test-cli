(function (B) {
    // B.multicastClient.log = function (msg) {
    //     console.log("LOG", msg);
    // }

    B.multicastClient.enforceEmitOrder = true;

    B.multicastClient.triggerEvents = [
        "ready", "test:success", "test:failure",
        "test:error", "test:timeout", "suite:end"];

    window.onerror = function (message) {
        B.multicastClient.emit("uncaughtException", {
            name: "UncaughtError", message: message
        });

        return true;
    };

    // TMP!!!
    buster.env = buster.env || {};
    buster.env.path = window.location.href;

    // Format assertion messages nicely
    B.assertions.format = B.format.ascii;

    // Format log messages with unquoted strings
    // Means that log("One", "Two") -> "One Two", not "\"One\" \"Two\""
    var logFormatter = buster.create(B.format);
    logFormatter.quoteStrings = false;

    // Console and buster.log shorthand
    B.console = B.eventedLogger.create({
        formatter: buster.bind(logFormatter, "ascii")
    });

    B.log = buster.bind(B.console, "log");

    // Ship log messages over the wire
    B.console.on("log", function (msg) {
        B.multicastClient.emit("log", msg);
    });

    // Keep a reference to test cases and specs
    var contexts = [];
    B.addTestContext = function (context) { contexts.push(context); };
    B.testCase.onCreate = B.addTestContext;
    B.spec.describe.onCreate = B.addTestContext;

    // Listen to events from buster.assert to make the test runner count
    // assertions correctly
    function setUpAssertionCounting(runner) {
        var assertions = 0;
        buster.assertions.bind(runner, { "failure": "assertionFailure" });

        buster.assertions.on("pass", function () {
            assertions += 1;
        });

        runner.on("test:start", function () {
            assertions = 0;
        });

        buster.testRunner.assertionCount = function () {
            return assertions;
        };
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

    // Run tests on the signal
    B.multicastClient.on("tests:run", function (msg) {
        var runner = B.testRunner.create(msg.data);
        var reporter = B.reporters.jsonProxy.create(B.multicastClient);
        reporter.listen(runner);
        buster.assertions.throwOnFailure = false;
        setUpAssertionCounting(runner);

        buster.assert = buster.assertions.assert;
        buster.refute = buster.assertions.refute;

        runner.on("suite:end", function (res) {
            delete B.multicastClient.triggerEvents;
        });

        runner.runSuite(parsedContexts(contexts));
        contexts = [];
    });

    B.multicastClient.emit("ready", window.navigator.userAgent);
}(buster));


// TMP Performance fix
(function () {
    var i = 0;

    buster.nextTick = function (cb) {
        i += 1;

        if (i == 50) {
            setTimeout(function () {
                cb();
            }, 0);

            i = 0;
        } else {
            cb();
        }
    };
}());
