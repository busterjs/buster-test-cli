var ba = require("buster-analyzer");

module.exports = {
    createAnalyzer: function (logger, options) {
        var analyzer = ba.analyzer.create();
        if (options.failOn) { analyzer.failOn(options.failOn); }

        var reporter = ba.fileReporter.create(options.warnings || "all", {
            outputStream: logger.streamForLevel("warn"),
            color: options.color,
            bright: options.bright
        }).listen(analyzer);

        return analyzer;
    }
};
