var buster = require("buster");
var createAnalyzer = require("../lib/analyzer").createAnalyzer;
var cliHelper = require("buster-cli/lib/test-helper");
var stdioLogger = require("buster-stdio-logger");

buster.testCase("Analyzer helper", {
    setUp: function () {
        this.stdout = cliHelper.writableStream("stdout");
        this.stderr = cliHelper.writableStream("stderr");
        this.logger = stdioLogger(this.stdout, this.stderr);
    },

    "sets fail level on analyzer": function () {
        var analyzer = createAnalyzer(this.logger, { failOn: "warning" });
        analyzer.warning("Oh noes");
        assert(analyzer.status().failed);
    },

    "file reporter": {
        "prints to stderr": function () {
            var analyzer = createAnalyzer(this.logger, {});
            analyzer.warning("Oh noes");
            assert.stderr("Oh noes");
            assert.stdout(/^$/);
        }
    }
});
