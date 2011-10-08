function createRemoteEmitter() {
    var emitter = buster.eventEmitter.create();

    emitter.emit = function (event, data) {
        return buster.eventEmitter.emit.call(this, event, {
            data: data,
            topic: event
        });
    };

    return emitter;
}

buster.testRunner.onCreate(function (runner) {
    buster.wiredRunner = runner;
});
