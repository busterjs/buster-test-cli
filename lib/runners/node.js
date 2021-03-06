var tmpFile = require("../tmp-file");
var test = require("buster-test");
var path = require("path");
var when = require("when");
var fs = require("fs");
var _ = require("lodash");

// Error codes, as per FreeBSD's sysexit(3)
// Errors are mapped to sysexit(3) error codes wherever that makes sense
var EX_DATAERR = 65;
var EX_SOFTWARE = 70;

function writeManifest(fileName, manifests) {
    var manifest = _.extend.apply(_, manifests);
    fs.writeFileSync(fileName, JSON.stringify(manifest), "utf-8");
}

function cacheFile(config) {
    return tmpFile(path.join(config.rootPath || "", "buster-cache"));
}

function descriptiveRequire(file) {
    try {
        require(file);
    } catch (e) {
        var relative = file.replace(process.cwd(), ".");
        e.message = "Failed requiring " + relative + ": " + e.message;
        throw e;
    }
}

function readManifest(fileName, callback) {
    fs.readFile(fileName, "utf-8", function (err, contents) {
        try {
            callback(JSON.parse(contents));
        } catch (e) {
            callback({});
        }
    });
}

function processSection(config, section) {
    var d = when.defer();
    config.on("load:" + section, function (resourceSet) {
        readManifest(cacheFile(config), function (manifest) {
            resourceSet.process(manifest).then(d.resolver.resolve, d.resolver.reject);
        });
    });
    return d.promise;
}

var testRun = {
    create: function (config, options, logger, done) {
        return _.extend(Object.create(this), {
            config: config,
            options: options,
            logger: logger,
            callback: done
        });
    },

    configure: function () {
        // if (this.options.captureConsole &&
        //     typeof B.captureConsole === "function") {
        //     B.captureConsole();
        // }
    },

    start: function () {
        this.configure();
        try {
            var hookResolution = this.beforeRunHook();
            var configResolution = this.config.resolve();

            when.all([hookResolution, configResolution])
                .then(function (values) {
                    this.runTests(values[1], values[0]);
                }.bind(this))
                .catch(function (e) {
                    this.done(e);
                }.bind(this));
        } catch (e) {
            this.done(e);
        }
    },

    runTests: function (rs, manifests) {
        if (this.aborted) { return; }
        if (rs.loadPath.paths().length === 0) { return this.done(); }
        try {
            writeManifest(cacheFile(this.config), manifests);
            var runner = test.autoRun(this.options, {
                start:
                    this.config.runExtensionHook.bind(this.config, "testRun"),
                end: function () {
                    return this.done.apply(this, arguments);
                }.bind(this, null)
            });
            test.testContext.on("create", runner);
            rs.loadPath.paths().map(function (p) {
                return path.join(rs.rootPath, p);
            }).forEach(descriptiveRequire);
        } catch (e) {
            e.code = EX_DATAERR;
            this.done(e);
        }
    },

    done: function (err) {
        if (!this.callback) { return; }
        if (err) {
            err.code = err.code || EX_SOFTWARE;
        }
        this.callback.apply(this, arguments);
        delete this.callback;
    },

    abort: function (err) {
        this.aborted = true;
        this.done(err);
    },

    beforeRunHook: function () {
        this.config.runExtensionHook("beforeRun");
        var sections = ["libs", "sources", "testHelpers", "tests"];

        return when.all(sections.map(processSection.bind(null, this.config)));
    }
};

module.exports = {
    testRun: testRun,

    create: function (options) {
        return Object.create(this);
    },

    run: function (config, options, done) {
        var run = testRun.create(config, options, this.logger, done);
        run.start();
        return run;
    }
};
