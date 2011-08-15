var config = module.exports;

config["Node tests"] = {
    environment: "node",
    tests: ["test/node/**/*.js"]
};

config["Browser tests"] = {
    environment: "browser",
    src: ["lib/buster-test-cli/browser/wiring.js"],
    tests: ["test/browser/test-helper.js",
            "test/browser/**/*.js"]
};
