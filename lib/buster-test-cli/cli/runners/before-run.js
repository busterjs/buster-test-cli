var buster = require("buster-core");
var bAnalyzer = require("buster-analyzer").analyzer;

function formatWarning(label, details) {
    var str = label + ":";
    details = details || "";

    if (details.indexOf("\n") >= 0) {
        return str + "\n    " + details.split("\n").join("\n    ");
    }

    return str + " " + details;
}

module.exports = {
    create: function (config, logger, options) {
        options = options || {};
        var analyzer = bAnalyzer.create();
        analyzer.failOn(options.failOn || "fatal");

        return buster.extend(Object.create(this), {
            config: config,
            logger: logger,
            warnings: options.warnings || "all",
            analyzer: analyzer
        });
    },

    addExtension: function (extension) {
        this.config.extensions.push(extension);
        return this;
    },

    beforeRunHook: function (onFail) {
        var listener = function (level, warnings, message, data) {
            var msg = formatWarning(message, data && data.toString());
            this.logger[warnings]("[" + level + "]", msg);
        };

        // TODO: Make a proper reporter that handles this
        this.analyzer.on("fatal", listener.bind(this, "FATAL", "e"));
        if (this.warnings == "error" ||
            this.warnings == "warning" ||
            this.warnings == "all") {
            this.analyzer.on("error", listener.bind(this, "ERROR", "e"));
            if (this.warnings != "error") {
                this.analyzer.on("warning", listener.bind(this, "WARNING", "w"));
            }
        }

        this.analyzer.on("fail", onFail);
        this.config.runExtensionHook("beforeRun", this.config, this.analyzer);
    }
};
