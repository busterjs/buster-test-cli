var sys = require("sys");
var terminal = require("buster-terminal");

module.exports = {
    create: function (opt) {
        var reporter = Object.create(this);
        reporter.terminal = terminal.create(opt);
        reporter.list = terminal.labeledList.create(opt && opt.io);

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
        this.list.print(this.clients[client.id], output);
    },

    addClient: function (clientId, agent) {
        this.clients = this.clients || {};
        var agentStr = agent.toString();
        this.clients[clientId] = agentStr;
        this.list.add(agentStr);
    }
};
