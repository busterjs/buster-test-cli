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

    // Ship log messages over the wire
    B.console.on("log", function (msg) {
        B.multicastClient.emit("log", msg);
    });

    // Keep a reference to test cases and specs
    var contexts = [];
    B.addTestContext = function (context) { contexts.push(context); };
    B.testCase.onCreate = B.addTestContext;
    B.spec.describe.onCreate = B.addTestContext;

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
