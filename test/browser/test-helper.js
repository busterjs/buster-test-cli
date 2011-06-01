buster.multicastClient = buster.eventEmitter.create();

buster.multicastClient.emit = function (event, data) {
    return buster.eventEmitter.emit.call(this, event, {
        data: data,
        topic: event
    });
};

buster.resetMulticastClient = function () {
    delete buster.multicastClient.listeners;
    delete buster.multicastClient.contexts;
};

buster.testRunner.onCreate(function (runner) {
    buster.wiredRunner = runner;
});