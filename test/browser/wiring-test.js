(function (B) {
    if (typeof require == "function" && typeof module == "object") {
        return;
    }

    buster.util.testCase("BrowserWiringTest", {
        setUp: function () {
            this.emitter = createRemoteEmitter();
            this.readyListener = sinon.spy();
            this.emitter.on("ready", this.readyListener);
            B.configureTestClient(this.emitter);

            this.bnt = buster.nextTick;

            buster.nextTick = function (callback) {
                callback();
            };
        },

        tearDown: function () {
            buster.nextTick = this.bnt;
        },

        "should connect bayeux emitter": function () {
            assertTrue(this.emitter.connect.calledOnce);
        },

        "should not emit ready immediately": function () {
            assertFalse(this.readyListener.called);
        },

        "should emit ready when connected": function () {
            this.emitter.connect.args[0][0]();

            assertTrue(this.readyListener.calledOnce);
        },

        "should emit user agent string with ready event": function () {
            this.emitter.connect.args[0][0]();

            assertTrue(/Mozilla/.test(this.readyListener.args[0][0].data));
        },

        "should set up console and buster.log shortcut": function () {
            assertObject(buster.console);
            assertFunction(buster.log);
        },

        "should format log messages nicely": function () {
            var message;
            buster.console.on("log", function (msg) { message = msg.message });
            buster.console.log("Hello world", { id: 42 });

            assertEquals("Hello world { id: 42 }", message);
        },

        "should log messages through buster.log": function () {
            var message;
            buster.console.on("log", function (msg) { message = msg.message });
            buster.log("Hello world", { id: 42 });

            buster.assert.equals(message, "Hello world { id: 42 }");
        },

        "should send log messages over the wire": function () {
            var listener = sinon.spy();
            this.emitter.on("log", listener);

            buster.console.warn("Hello world", { id: 42 });
            assertTrue(listener.calledOnce);

            var msg = listener.args[0][0];
            assertEquals("log", msg.topic);

            assertEquals({
                message: "Hello world { id: 42 }",
                level: "warn"
            }, msg.data);
        },

        "should start running tests when emitting tests:run": function () {
            var listener = sinon.spy();
            this.emitter.on("suite:start", listener);

            buster.testCase("SomeTest", { "should do it": function () {} });
            this.emitter.emit("tests:run");

            assertTrue(listener.calledOnce);
        },

        "should run specs when emitting tests:run": function () {
            var listener = sinon.spy();
            this.emitter.on("context:start", listener);

            buster.spec.describe("Spec", function () {
                buster.spec.should("do it", function () {});
            });

            this.emitter.emit("tests:run");

            assertTrue(listener.calledOnce);
            assertEquals(listener.args[0][0].data.name, "Spec");
        },

        "should run parsable context when emitting tests:run": function () {
            var listener = sinon.spy();
            this.emitter.on("context:start", listener);

            buster.addTestContext({
                parse: function () {
                    return { name: "Parsed", tests: [] };
                }
            });

            this.emitter.emit("tests:run");

            assertTrue(listener.calledOnce);
            assertEquals(listener.args[0][0].data.name, "Parsed");
        },

        "should create test runner with options": function () {
            this.emitter.emit("tests:run", {
                timeout: 25, failOnNoAssertions: false
            });

            assertEquals(buster.wiredRunner.timeout, 25);
            assertFalse(buster.wiredRunner.failOnNoAssertions);
        },

        "should configure assertions to not throw": function () {
            this.emitter.emit("tests:run");

            assertFalse(buster.assertions.throwOnFailure);
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

            this.emitter.emit("tests:run");

            assertEquals(counts, [1, 2]);
        }
    });
}(buster));
