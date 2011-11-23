var version = require("../buster-test-cli").VERSION;

module.exports = {
    extendConfigurationGroupWithWiring: function (configGroup) {
        configGroup.resourceSet.addFile(require.resolve("./browser/wiring.js"), {
            path: "/buster/wiring.js"
        });

        configGroup.resourceSet.addFile(require.resolve("./browser/ready.js"), {
            path: "/buster/ready.js"
        });

        configGroup.resourceSet.prependToLoad("/buster/wiring.js");
        configGroup.setupFrameworkResources();
        configGroup.resourceSet.appendToLoad("/buster/ready.js");

        return configGroup;
    }
};
