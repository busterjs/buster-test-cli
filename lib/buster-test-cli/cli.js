var buster = {
    args: require("buster-args"),
    stdioLogger: require("./stdio-logger")
};

function done(cli, method, arg, callback) {
    cli[method](arg);

    if (typeof callback == "function") {
        callback();
    }
}

module.exports = {
    create: function (stdout, stderr) {
        var cli = Object.create(this);
        cli.logger = buster.stdioLogger.create(stdout, stderr);
        cli.logger.level = cli.logger.LOG;

        return cli;
    },

    err: function err(message) {
        this.logger.error(message);
        process.exit(1);
    },

    run: function (args, callback) {
        var opt = this.options && this.options() || Object.create(buster.args);
        var help = opt.createOption("-h", "--help");
        help.help = "Print this message";

        this.logLevel = opt.createOption("-l", "--loglevel");
        this.logLevel.hasValue = true;
        this.logLevel.help = "Set log level, one of " +
            this.logger.levels.join(", ") + ". Default is log.";
        this.logLevel.addValidator(buster.args.validators.inEnum(this.logger.levels));
        this.logLevel.defaultValue = "log";

        opt.handle(args, function (errors) {
            this.logger.level = this.logLevel.value();
            if (errors) return done(this, "err", errors[0], callback);
            if (help.isSet) return done(this, "printHelp", opt, callback);

            if (typeof this.onRun == "function") {
                this.onRun(callback);
            } else {
                if (typeof callback == "function") callback();
            }
        }.bind(this));
    },

    printHelp: function (opt) {
        this.logger.log(this.missionStatement + "\n");
        if (this.usage) this.logger.log("Usage: " + this.usage);
        if (this.description) this.logger.log(this.description);
        var options = opt.options;

        if (options.length > 0 && (!!this.description || !!this.usage)) {
            this.logger.log("");
        }

        this.logger.log("Arguments");

        var width = 0, i, padding;

        for (i = 0; i < options.length; i++) {
            width = Math.max((options[i].signature || "").length, width);
        }

        for (i = 0; i < options.length; i++) {
            if (!options[i].signature) continue;
            padding = "";

            while (width - options[i].signature.length - padding.length > 0) {
                padding += " ";
            }

            this.logger.log("    " + options[i].signature + padding + " " +
                            (options[i].help || ""));
        }
    }
};
