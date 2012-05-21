var B = require("buster-core");
var test = require("buster-test");
var path = require("path");
var when = require("when");
var fs = require("fs");

// Error codes, as per FreeBSD's sysexit(3)
// Errors are mapped to sysexit(3) error codes wherever that makes sense
var EX_DATAERR = 65;
var EX_SOFTWARE = 70;

function writeManifest(fileName, manifests) {
    var manifest = B.extend.apply(B, manifests);
    fs.writeFileSync(fileName, JSON.stringify(manifest), "utf-8");
}

function runTests(rs, manifests, logger, config, options, done) {
    try {
        writeManifest(config.tmpFile("buster-cache"), manifests);
        var runner = test.autoRun(options, {
            start: B.bind(config, "runExtensionHook", "testRun"),
            end: B.partial(done, null)
        });
        test.testContext.on("create", runner);
        var fullPath = B.partial(path.join, rs.rootPath);
        rs.loadPath.paths().map(fullPath).forEach(require);
    } catch (e) {
        logger.e(e.stack);
        e.code = EX_DATAERR;
        done(e);
    }
}

function readManifest(fileName) {
    try {
        return JSON.parse(fs.readFileSync(fileName));
    } catch (e) {
        return {};
    }
}

function processSection(config, section) {
    var d = when.defer();
    config.on("load:" + section, function (resourceSet) {
        var manifest = readManifest(config.tmpFile("buster-cache"));
        when.chain(resourceSet.process(manifest), d.resolver);
    });
    return d.promise;
}

module.exports = {
    create: function (options) {
        return B.extend(B.create(this), {
            logger: options && options.logger
        });
    },

    configureRun: function (options) {
        if (options.captureConsole && typeof B.captureConsole === "function") {
            B.captureConsole();
        }
    },

    run: function (config, options, done) {
        this.configureRun(options);
 
        when.all([
            config.resolve(),
            this.beforeRunHook(config, options)
        ]).then(function (values) {
            runTests(values[0], values[1], this.logger, config, options, done);
        }.bind(this), function (err) {
            if (this.logger) {
                this.logger.e(err && err.message || err);
            }
            done(err);
        }.bind(this));
    },

    beforeRunHook: function (config, options) {
        var d = when.defer();
        // var stream = this.logger.streamForLevel("warn");
        // var hook = beforeRun.create(config, stream, options);
        // hook.logger = this.logger;

        // hook.beforeRunHook(function (stats) {
        //     var err = new Error("Pre-condition failed");
        //     err.type = "AnalyzerError";
        //     err.code = EX_SOFTWARE;
        //     d.resolver.reject(err);
        //     d = null;
        // });

        var sections = ["libs", "sources", "testHelpers", "tests"];
        when.all(sections.map(B.partial(processSection, config))).then(
            function (manifests) { if (d) { d.resolver.resolve(manifests); } },
            function (err) { if (d) { d.resolver.reject(err); } }
        );
        return d.promise;
    }
};
