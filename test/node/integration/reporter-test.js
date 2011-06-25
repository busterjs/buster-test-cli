var helper = require("../test-helper");

if (require.main != module) {
    console.log("Integration test must be run manually - it is a visual test");
    console.log("node test/node/integration/reporter-test.js\n");
} else {
    run();
}

function run() {
    var buster = require("buster");
    buster.remoteRunner = helper.require("test-runner/remote-runner");
    buster.progressReporter = helper.require("test-runner/progress-reporter");

    var multicaster = buster.eventEmitter.create();

    function emit(event, data, client) {
        return multicaster.emit(event, {
            topic: event,
            data: data,
            clientId: client
        });
    };

    function addClient(id, client) {
        emit("ready", client, id);
        emit("suite:start", {}, id);
        reporter.addClient(id, runner.clients[id]);
    }

    var runner = buster.remoteRunner.create(multicaster);
    var clients = ["Mozilla/5.0 (X11; Linux x86_64; rv:2.0.1) Gecko/20100101 Firefox/4.0.1", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/534.24 (KHTML, like Gecko) Chrome/11.0.696.71 Safari/534.24"];

    var reporter = buster.progressReporter.create({
        io: require("sys"),
        color: true, bright: true
    }).listen(runner);

    console.log("If this output looks good, we're fine. Control-C to abort");
    console.log("\"Fine\": List of browsers with growing list of dots and letters");

    setTimeout(function () {
        addClient(1, clients[0]);
        addClient(2, clients[1]);

        var events = ["test:success", "test:error", "test:failure", "test:timeout"];

        function doIt() {
            emit(events[Math.floor(Math.random() * events.length)], {},
                 1 + Math.floor(Math.random() * clients.length));
        }

        setInterval(doIt, 50);
    }, 500);

    setTimeout(function () {
        clients.push("Mozilla/5.0 (Windows; U; MSIE 9.0; WIndows NT 9.0; en-US))");
        addClient(3, clients[2]);
    }, 2000);
}
