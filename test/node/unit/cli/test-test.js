var helper = require("../../test-helper");
var buster = require("buster");
var testCli = helper.require("cli/test");

buster.testCase("Test client cli", {
    setUp: function () {
        this.cli = Object.create(testCli);
        this.stub(process, "exit");
    }// ,

    // "run": {
    //     "should print help message": function () {
    //         this.stub(console, "log");

    //         this.cli.run([""
    //     }
    // }
});
