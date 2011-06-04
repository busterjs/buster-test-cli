var buster = { args: require("buster-args") };

function done(cli, method, arg, callback) {
    cli[method](arg);

    if (typeof callback == "function") {
        callback();
    }
}

module.exports = {
    create: function (stdout, stderr) {
        var cli = Object.create(this);
        cli.stdout = stdout;
        cli.stderr = stderr;

        return cli;
    },

    err: function err(message) {
        this.stderr.puts(message);
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
        this.stdout.puts(this.missionStatement + "\n");
        if (this.description) this.stdout.puts(this.description);
        if (this.usage) this.stdout.puts(this.usage);
        var options = opt.options;

        if (options.length > 0 && (!!this.description || !!this.usage)) {
            this.stdout.puts("");
        }

        this.stdout.puts("Arguments");

        for (var i = 0; i < options.length; i++) {
            this.stdout.puts("    " + options[i].signature + " " +
                             (options[i].help || ""));
        }
    }
};
