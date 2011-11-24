var config = module.exports;

config["Node tests"] = {
    environment: "node",
    tests: ["node/**/*.js"]
};

config["Browser tests"] = {
    rootPath: "../",
    environment: "browser",
    src: ["lib/buster-test-cli/browser/wiring.js"],
    tests: ["test/browser/test-helper.js",
            "test/browser/**/*.js"]
};
