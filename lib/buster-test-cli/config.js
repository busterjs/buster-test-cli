var version = require("../buster-test-cli").VERSION;

module.exports = {
    extendConfigurationGroupWithWiring: function (configGroup) {
        configGroup.resourceSet.addFile(require.resolve("./browser/wiring.js"), {
            path: "/buster/wiring.js"
        });

        configGroup.resourceSet.prependToLoad("/buster/wiring.js");
        configGroup.setupFrameworkResources();

        return configGroup;
    }
};
