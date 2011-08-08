var buster = {
    args: require("buster-args"),
    stdioLogger: require("./stdio-logger")
};

var term = require("buster-terminal");
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

        if ("defaultValue" in options) {
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
        this.addOptions();

        this.args.handle(args, function (errors) {
            this.logger.level = this.logLevel.value();
            if (errors) return done(this, "err", errors[0], callback);
            if (this._help.isSet) return done(this, "printHelp", this.args, callback);

            if (typeof this.onRun == "function") {
                this.onRun(callback);
            } else {
                if (typeof callback == "function") callback();
            }
        }.bind(this));
    },

    addOptions: function () {
        this.options();
        this._help = this.opt("-h", "--help", "Show this message", {
            defaultValue: ""
        });

        this.logLevel = this.opt("-l", "--log-level", "Set log level", {
            values: this.logger.levels,
            defaultValue: "log"
        });
    },

    printHelp: function (opt) {
        var topic = this._help.value();

        if (topic) {
            var topics = this.help || {};

            if (!topics[topic]) {
                this.logger.error("No such help topic `" + topic + "'. Try one of");
                this.logger.error(Object.keys(topics).join(", "));
                return;
            }

            this.logger.log(topics[topic]);
        } else {
            this.printCliHelp(opt);
        }
    },

    printCliHelp: function (opt) {
        this.logger.log(this.missionStatement + "\n");
        if (this.usage) this.logger.log("Usage: " + this.usage);
        if (this.description) this.logger.log(this.description);
        var opts = opt.options.filter(function (o) { return !!o.signature; });

        if (opts.length > 0 && (!!this.description || !!this.usage)) {
            this.logger.log("");
        }

        this.logger.log("Arguments");
        var w = term.strings.maxWidth(opts.map(function (o) { return o.signature; }));
        var logger = this.logger;

        opts.forEach(function (o) {
            logger.log("    " + term.strings.alignLeft(o.signature, w) + " " + o.help);
        });
    }
};
