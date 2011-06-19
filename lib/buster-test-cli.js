var path = require("path");
var fs = require("fs");

module.exports = {
    get VERSION () {
        if (!this.version) {
            var pkgJSON = path.resolve(__dirname, "..", "package.json");
            this.version = JSON.parse(fs.readFileSync(pkgJSON, "utf8")).version;
        }

        return this.version;
    }
};
