var terminal = require("buster-terminal");

module.exports = {
    create: function (opt) {
        var reporter = Object.create(this);
        reporter.terminal = terminal.create(opt);
        reporter.matrix = terminal.createMatrix({
            io: opt && opt.io,
            columns: 2
        });
        reporter.matrix.resizeColumn(1, 80);
        reporter.matrix.freezeColumn(1);
        return reporter;
    },

    listen: function (runner) {
        runner.bind(this, {
            "progress:test:success": "testSuccess",
            "progress:test:error": "testError",
            "progress:test:failure": "testFailure",
            "progress:test:timeout": "testTimeout"
        });

        return this;
    },

    testSuccess: function (test) {
        this.print(test.client, this.terminal.green("."));
    },

    testError: function (test) {
        this.print(test.client, this.terminal.yellow("E"));
    },

    testFailure: function (test) {
        this.print(test.client, this.terminal.red("F"));
    },

    testTimeout: function (test) {
        this.print(test.client, this.terminal.red("T"));
    },

    displayProgress: function (client, output) {
        if (!this.list) {
            return this.bufferOutput(client, output);
        }

        this.print(client, output);
    },

    print: function (client, output) {
        this.matrix.rowById(this.clients[client.id]).append(1, output);
    },

    addClient: function (clientId, agent) {
        this.clients = this.clients || {};
        this.clients[clientId] = this.matrix.addRow([agent.toString() + ":", ""]);
    }
};
