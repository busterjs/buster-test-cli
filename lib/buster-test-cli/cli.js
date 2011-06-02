var buster = { args: require("buster-args") };

module.exports = function (cli) {
    cli.create = function (stdout, stderr) {
        var cli = Object.create(this);
        cli.stdout = stdout;
        cli.stderr = stderr;

        return cli;
    };

    cli.err = function err(message) {
        this.stderr.puts(message);
        process.exit(1);
    };

    var runCli = cli.run;

    cli.run = function (args) {
        var opt = this.options || Object.create(buster.args);
        var help = opt.createOption("-h", "--help");
        help.help = "Print this message";

        opt.handle(args, function (errors) {
            if (errors) {
                return this.err(errors[0]);
            }

            if (help.isSet) {
                this.stdout.puts(this.missionStatement + "\n");
                if (this.description) this.stdout.puts(this.description);
                if (this.usage) this.stdout.puts(this.usage);

                for (var i = 0; i < opt.length; i++) {
                    this.stdout.puts("    " + opt[i].signature + " " + opt[i].help);
                }

                return;
            }

            if (typeof runCli == "function") runCli.call(this);
        }.bind(this));
    };

    return cli;
};
