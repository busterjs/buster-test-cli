var B = require("buster-core");
var test = require("buster-test");
B.autoRun = test.autoRun;
B.testCase = test.testCase;
B.spec = test.spec;
var path = require("path");
var beforeRun = require("./before-run");
var when = require("when");

function runTests(rs, logger, config, options, done) {
    try {
        var runner = B.autoRun(options, done);
        B.testCase.onCreate = runner;
        B.spec.describe.onCreate = runner;

        var fullPath = B.partial(path.join, rs.rootPath);
        rs.loadPath.paths().map(fullPath).forEach(require);
    } catch (e) {
        logger.e(e.stack);
    }
}

module.exports = {
    run: function (config, options, done) {
        var promise = this.beforeRunHook(config, options);

        when.all([config.resolve(), promise]).then(function (resourceSets) {
            runTests(resourceSets[0], this.logger, config, options, done);
        }.bind(this), function (err) {
            if (this.logger) {
                this.logger.e(err && err.message || err);
            }
            done();
        }.bind(this));
    },

    beforeRunHook: function (config, options) {
        var deferred = when.defer();
        var hook = beforeRun.create(config, this.logger, options);

        hook.beforeRunHook(function () {
            deferred.resolver.reject();
            deferred = null;
        });

        when.all(["libs", "sources", "testLibs", "tests"].map(function (section) {
            var d = when.defer();
            config.on("load:" + section, function (resourceSet) {
                resourceSet.process().then(B.bind(d.resolver, "resolve"),
                                           B.bind(d.resolver, "reject"));
            });
            return d.promise;
        })).then(function () { if (deferred) { deferred.resolver.resolve(); } },
                 function (err) { if (deferred) { deferred.resolver.reject(err); } });
        return deferred.promise;
    }
};
