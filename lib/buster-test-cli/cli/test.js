module.exports = {
    create: function (stdout, stderr) {
        var cli = Object.create(this);
        cli.stdout = stdout;
        cli.stderr = stderr;

        return cli;
    },

    run: function () {}
};
