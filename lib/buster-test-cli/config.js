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

var noCacheHeaders = {
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Expires": "0"
};

function addFileResources(config) {
    var files = Array.prototype.slice.call(arguments, 1);
    var fileName, paths = [];

    for (var i = 0, l = files.length; i < l; ++i) {
        fileName = require.resolve(files[i][0] + "/lib/" + files[i][1]);

        config.sessionConfig.addFileAsResource(fileName, {
            path: "/buster/" + files[i][1]
        });

        paths.push("/buster/" + files[i][1]);
    }

    return paths;
}
