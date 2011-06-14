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

        return cli;
    },

    err: function err(message) {
        this.logger.e(message);
        process.exit(1);
    },

    run: function (args, callback) {
        var opt = this.options && this.options() || Object.create(buster.args);
        var help = opt.createOption("-h", "--help");
        help.help = "Print this message";

        opt.handle(args, function (errors) {
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
        if (this.description) this.logger.log(this.description);
        if (this.usage) this.logger.log(this.usage);
        var options = opt.options;

        if (options.length > 0 && (!!this.description || !!this.usage)) {
            this.logger.log("");
        }

        this.logger.log("Arguments");

        for (var i = 0; i < options.length; i++) {
            this.logger.log("    " + options[i].signature + " " +
                            (options[i].help || ""));
        }
    }
};
