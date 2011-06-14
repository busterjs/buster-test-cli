var buster = require("buster-core");
buster.eventedLogger = require("buster-evented-logger");

function createShortLevelAliases(logger) {
    logger.d = logger.debug;
    logger.i = logger.info;
    logger.l = logger.log;
    logger.w = logger.warn;
    logger.e = logger.error;
}

function defaultLogger(logger, defaultConsoleMethod) {
    if (logger && typeof logger.puts == "function") {
        return logger;
    }

    return {
        puts: function () {
            return console[defaultConsoleMethod].apply(console, arguments);
        }
    };
}

module.exports = {
    create: function (stdout, stderr) {
        var logger = buster.eventedLogger.create({
            levels: ["error", "warn", "log", "info", "debug"]
        });

        this.subscribeReporter(logger, this.createReporter(stdout, stderr));
        createShortLevelAliases(logger);

        return logger;
    },

    createReporter: function (out, err) {
        var stdout = defaultLogger(out, "log");
        var stderr = defaultLogger(err, "error");

        return {
            log: stdout,
            info: stdout,
            debug: stdout,
            warn: stderr,
            error: stderr
        };
    },

    subscribeReporter: function (logger, reporter) {
        logger.on("log", function (msg) {
            var prefix = logger.verbose ? "[" + msg.level.toUpperCase() + "] " : "";
            reporter[msg.level].puts(prefix + msg.message);
        });
    }
};
