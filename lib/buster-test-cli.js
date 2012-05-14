var buster = require("buster-core");
buster.defineVersionGetter(module.exports, __dirname);

module.exports.cli = {
    test: require("./buster-test-cli/cli/test")
};
