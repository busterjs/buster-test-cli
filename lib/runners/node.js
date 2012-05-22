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

function cacheFile(config) {
    return B.tmpFile(path.join(config.rootPath, "buster-cache"));
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

function runTests(rs, manifests, config, options) {
    if (this.aborted) { return; }
    if (this.cacheable) { writeManifest(cacheFile(config), manifests); }

    try {
        var runner = test.autoRun(options, {
            start: B.bind(config, "runExtensionHook", "testRun"),
            end: B.bind(this, "done", null)
        });
        test.testContext.on("create", runner);
        var fullPath = B.partial(path.join, rs.rootPath);
        rs.loadPath.paths().map(fullPath).forEach(descriptiveRequire);
    } catch (e) {
        e.code = EX_DATAERR;
        this.done(e);
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
            var pd = resourceSet.process(manifest);
            when.chain(pd, d.resolver);
        });
    });
    return d.promise;
}

function manifestsGenerated(manifests) {
    if (!this.processDeferred) { return; }
    this.processDeferred.resolve(manifests);
    delete this.processDeferred;
}

function manifestsFailed(err) {
    if (!this.processDeferred) { return; }
    this.processDeferred.reject(err);
    delete this.processDeferred;
}

module.exports = {
    create: function (options) {
        return B.extend(B.create(this), { cacheable: options.cacheable });
    },

    configureRun: function (options) {
        if (options.captureConsole && typeof B.captureConsole === "function") {
            B.captureConsole();
        }
    },

    run: function (config, options, done) {
        this.callback = done;
        this.configureRun(options);

        try {
            when.all([this.beforeRunHook(config), config.resolve()]).
                then(function (values) {
                    runTests.call(this, values[1], values[0], config, options);
                }.bind(this), B.bind(this, "done"));
        } catch (e) {
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
        delete this.processDeferred;
        this.done(err);
    },

    beforeRunHook: function (config) {
        config.runExtensionHook("beforeRun");
        this.processDeferred = when.defer();
        var sections = ["libs", "sources", "testHelpers", "tests"];
        when.all(sections.map(B.partial(processSection, config))).then(
            B.bind(this, manifestsGenerated),
            B.bind(this, manifestsFailed)
        );
        return this.processDeferred.promise;
    }
};
