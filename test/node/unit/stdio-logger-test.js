var helper = require("../test-helper");
var buster = require("buster");
var assert = buster.assert;
var stdioLogger = helper.require("stdio-logger");

buster.testCase("stdio logger", {
    setUp: function () {
        var self = this;
        this.stdout = "";
        this.stderr = "";
        var join = function (arr, sep) { return [].join.call(arr, sep); };

        this.logger = stdioLogger.create(
            { puts: function () { self.stdout += join(arguments, " ") + "\n"; } },
            { puts: function () { self.stderr += join(arguments, " ") + "\n"; } }
        );
    },

    "should print debug messages to stdout": function () {
        this.logger.d("Hey");
        this.logger.d("There");

        assert.equals(this.stdout, "Hey\nThere\n");
    },

    "should print info messages to stdout": function () {
        this.logger.info("Hey");
        this.logger.i("There");

        assert.equals(this.stdout, "Hey\nThere\n");
    },

    "should print log messages to stdout": function () {
        this.logger.log("Hey");
        this.logger.l("There");

        assert.equals(this.stdout, "Hey\nThere\n");
    },

    "should print warning messages to stderr": function () {
        this.logger.warn("Hey");
        this.logger.w("There");

        assert.equals(this.stderr, "Hey\nThere\n");
    },

    "should print error messages to stderr": function () {
        this.logger.error("Hey");
        this.logger.e("There");

        assert.equals(this.stderr, "Hey\nThere\n");
    },

    "should prefix with log level when being verbose": function () {
        this.logger.verbose = true;

        this.logger.d("Hey");
        this.logger.i("There");
        this.logger.l("Fella");
        this.logger.w("Woops");
        this.logger.e("Game over");

        assert.equals(this.stdout, "[DEBUG] Hey\n[INFO] There\n[LOG] Fella\n");
        assert.equals(this.stderr, "[WARN] Woops\n[ERROR] Game over\n");
    },

    "should default to console for stdio": function () {
        this.stub(console, "log");
        this.stub(console, "error");
        var logger = stdioLogger.create();

        logger.i("Hey");
        logger.e("Game over");

        assert.calledOnce(console.log);
        assert.calledWith(console.log, "Hey");
        assert.calledOnce(console.error);
        assert.calledWith(console.error, "Game over");
    }
});
