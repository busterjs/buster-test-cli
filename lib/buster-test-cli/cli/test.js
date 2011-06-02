var buster = require("buster-core");
buster.args = require("buster-args");
buster.cli = require("../cli");

module.exports = buster.extend(buster.create(buster.cli), {
    missionStatement: "Run Buster.JS tests on node, in browsers, or both"
});
