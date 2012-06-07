var buster = require("buster");
var runAnalyzer = require("../lib/run-analyzer");
var cliHelper = require("buster-cli/lib/test-helper");
var stdioLogger = require("buster-stdio-logger");

buster.testCase("Analyzer helper", {
    setUp: function () {
        this.stdout = cliHelper.writableStream("stdout");
        this.stderr = cliHelper.writableStream("stderr");
        this.logger = stdioLogger(this.stdout, this.stderr);
    },

    "sets fail level on analyzer": function () {
        var analyzer = runAnalyzer.create(this.logger, { failOn: "warning" });
        analyzer.warning("Oh noes");
        assert(analyzer.status().failed);
    },

    "file reporter": {
        "prints to stderr": function () {
            var analyzer = runAnalyzer.create(this.logger, {});
            analyzer.warning("Oh noes");
            assert.stderr("Oh noes");
            assert.stdout(/^$/);
        }
    },

    "run analysis": {
        setUp: function () {
            this.analyzer = runAnalyzer.create(this.logger, {});
            this.run = { abort: this.spy() };
            this.runner = { run: this.stub().returns(this.run) };
            this.config = { runExtensionHook: this.spy() };
        },

        "prevents caching on warning": function () {
            this.analyzer.run(this.runner, this.config);
            this.analyzer.emit("warning", {});

            assert.isFalse(this.run.cacheable);
        },

        "prevents caching on error": function () {
            this.analyzer.run(this.runner, this.config);
            this.analyzer.emit("error", {});

            assert.isFalse(this.run.cacheable);
        },

        "prevents caching on fatal": function () {
            this.analyzer.run(this.runner, this.config);
            this.analyzer.emit("fatal", {});

            assert.isFalse(this.run.cacheable);
        },

        "triggers analyze extension hook": function () {
            this.analyzer.run(this.runner, this.config);

            var hook = this.config.runExtensionHook;
            assert.calledOnce(hook);
            assert.calledOnceWith(hook, "analyze", this.analyzer);
        },

        "starts run": function () {
            this.analyzer.run(this.runner, this.config);

            assert.calledOnce(this.runner.run);
            assert.calledWith(this.runner.run, this.config, {});
        },

        "aborts run if analyzer fails": function () {
            this.analyzer.run(this.runner, this.config);
            this.analyzer.emit("fail", { errors: 42 });

            assert.calledOnce(this.run.abort);
            assert.match(this.run.abort.args[0][0], {
                stats: { errors: 42 },
                type: "AnalyzerError",
                message: "Pre-condition failed"
            });
        },

        "calls callback when analyzer fails run": function () {
            var callback = this.spy();
            this.analyzer.run(this.runner, this.config, callback);
            this.analyzer.emit("fail", { errors: 42 });

            assert.calledOnce(callback);
        },

        "only calls callback once": function () {
            var callback = this.spy();
            this.analyzer.run(this.runner, this.config, callback);
            this.analyzer.emit("fail", { errors: 42 });
            this.runner.run.yield(null);

            assert.calledOnce(callback);
        },

        "only calls callback once when analyzer fails after run": function () {
            var callback = this.spy();
            this.analyzer.run(this.runner, this.config, callback);
            this.runner.run.yield(null);
            this.analyzer.emit("fail", { errors: 42 });

            assert.calledOnce(callback);
        }
    }
});
