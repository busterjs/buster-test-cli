var path = require("path");
var buster = require("buster-core");
buster.args = require("buster-args");
buster.cli = require("../cli");

function loadConfig(config) {
    if (!config) return;

    try {
        var mod = path.resolve(process.cwd(), config.replace(".js", ""));
        return require(mod);
    } catch (e) {
        if (e.message != "Cannot find module '" + mod + "'") {
            throw e;
        }
    }
}

module.exports = buster.extend(buster.create(buster.cli), {
    missionStatement: "Run Buster.JS tests on node, in browsers, or both",

    onRun: function (callback) {
        this.onConfig(function (config) {
            this.logger.log("Yay");
            this.logger.log(config);
        });

        callback();
    },

    options: function () {
        var args = Object.create(buster.args);
        this._config = args.createOption("--config", "-c");
        this._config.hasValue = true;
        this._config.help = "Test configuration file";
        this._config.addValidator(buster.args.validators.file(
            "", this._config.signature + ": ${1} is not a file"));

        return args;
    },

    onConfig: function (callback) {
        var config = loadConfig(this._config.value());
        if (!config) config = loadConfig("buster.js");
        if (!config) config = loadConfig("test/buster.js");
        if (!config) config = loadConfig("spec/buster.js");

        callback.call(this, config);
    }
});
