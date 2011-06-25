var buster = {
    args: require("buster-args"),
    stdioLogger: require("./stdio-logger")
};

var argValidators = buster.args.validators;

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

    opt: function opt(short, long, help, options) {
        this.args = this.args || Object.create(buster.args);
        var opt = this.args.createOption(short, long);
        opt.help = help;
        if (!options) return opt;

        if (options.values) {
            opt.help += ", one of " + options.values.join(", ");
            opt.addValidator(argValidators.inEnum(options.values));
        }

        if (options.defaultValue) {
            opt.help += ". Default is " + options.defaultValue;
            opt.hasValue = true;
            opt.defaultValue = options.defaultValue;
        }

        if (options.hasValue) opt.hasValue = true;

        var validators = options.validators || {};

        for (var prop in validators) {
            opt.addValidator(argValidators[prop](validators[prop], validators[prop]));
        }

        return opt;
    },

    run: function (args, callback) {
        this.options();
        var help = this.opt("-h", "--help", "Show this message");

        this.logLevel = this.opt("-l", "--loglevel", "Set log level", {
            values: this.logger.levels,
            defaultValue: "log"
        });

        this.args.handle(args, function (errors) {
            this.logger.level = this.logLevel.value();
            if (errors) return done(this, "err", errors[0], callback);
            if (help.isSet) return done(this, "printHelp", this.args, callback);

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
