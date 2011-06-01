(function () {
    if (typeof require == "function" && typeof module == "object") {
        return;
    }

    buster.assert.fail = function (message) {
        fail(message);
    };

    buster.util.testCase("BrowserWiringTest", {
        setUp: function () {
            //buster.resetMulticastClient();
            this.bnt = buster.nextTick;
            buster.assert.throwOnFailure = true;

            buster.nextTick = function (callback) {
                callback();
            };
        },

        tearDown: function () {
            buster.nextTick = this.bnt;

            if (buster.assert.bind.restore) {
                buster.assert.bind.restore();
            }
        },

        "should set up console and buster.log shortcut": function () {
            buster.assert.isObject(buster.console);
            buster.assert.isFunction(buster.log);
        },

        "should format log messages nicely": function () {
            var message;
            buster.console.on("log", function (msg) { message = msg.message });
            buster.console.log("Hello world", { id: 42 });

            buster.assert.equals(message, "Hello world { id: 42 }");
        },

        "should log messages through buster.log": function () {
            var message;
            buster.console.on("log", function (msg) { message = msg.message });
            buster.log("Hello world", { id: 42 });

            buster.assert.equals(message, "Hello world { id: 42 }");
        },

        "should send log messages over the wire": function () {
            var listener = sinon.spy();
            buster.multicastClient.on("log", listener);

            buster.console.warn("Hello world", { id: 42 });

            buster.assert(listener.calledOnce);
            buster.assert.equals(listener.args[0][0], {
                topic: "log",
                data: {
                    message: "Hello world { id: 42 }",
                    level: "warn"
                }
            });
        },

        "should start running tests when emitting tests:run": function () {
            var listener = sinon.spy();
            buster.multicastClient.on("suite:start", listener);

            buster.testCase("Test", { "should do it": function () {} });
            buster.multicastClient.emit("tests:run");

            buster.assert(listener.calledOnce);
        },

        "should run specs when emitting tests:run": function () {
            var listener = sinon.spy();
            buster.multicastClient.on("context:start", listener);

            buster.spec.describe("Spec", function () {
                buster.spec.should("do it", function () {});
            });

            buster.multicastClient.emit("tests:run");

            buster.assert(listener.calledOnce);
            buster.assert.equals(listener.args[0][0].data.name, "Spec");
        },

        "should run parsable context when emitting tests:run": function () {
            var listener = sinon.spy();
            buster.multicastClient.on("context:start", listener);

            buster.addTestContext({
                parse: function () {
                    return { name: "Parsed", tests: [] };
                }
            });

            buster.multicastClient.emit("tests:run");

            buster.assert(listener.calledOnce);
            buster.assert.equals(listener.args[0][0].data.name, "Parsed");
        },

        "should create test runner with options": function () {
            buster.multicastClient.emit("tests:run", {
                timeout: 25, failOnNoAssertions: false
            });

            buster.assert.equals(buster.wiredRunner.timeout, 25);
            buster.assert.isFalse(buster.wiredRunner.failOnNoAssertions);
        },

        "should configure assertions to not throw": function () {
            buster.multicastClient.emit("tests:run");

            buster.assert.isFalse(buster.assert.throwOnFailure);
        },

        "should subscribe test runner to assertion failure": function () {
            sinon.spy(buster.assert, "bind");
            buster.multicastClient.emit("tests:run");

            buster.assert(buster.assert.bind.calledOnce);
            buster.assert(buster.assert.bind.calledWith(buster.wiredRunner, {
                "failure": "assertionFailure"
            }));
        },

        "should count assertions": function () {
            var counts = [];

            buster.testCase("AssertionCountTest", {
                tearDown: function () {
                    counts.push(buster.wiredRunner.assertionCount());
                },

                "test #1": function () {
                    buster.assert(true);
                },

                "test #2": function () {
                    buster.assert(true);
                    buster.assert(true);
                },
            });

            buster.multicastClient.emit("tests:run");

            buster.assert.equals(counts, [1, 2]);
        }
    });
}());
