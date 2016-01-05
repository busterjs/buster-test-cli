# buster-test-cli

[![Build status](https://secure.travis-ci.org/busterjs/buster-test-cli.png?branch=master)](http://travis-ci.org/busterjs/buster-test-cli)
[![Build status](https://ci.appveyor.com/api/projects/status/github/busterjs/buster-test-cli?branch=master&svg=true)](https://ci.appveyor.com/project/dominykas/buster-test-cli)

Library that supports the `buster-test` command line interface.


## Changelog

**0.9.0** (2015-Jan-05)

* BREAKING: Updated all dependencies (`ramp@2.x`, `when@3.x`, `buster-test@0.8.x`)
* BREAKING: added an engine requirement (node LTS) in `package.json` 
* Some code cleanup

**0.8.8** (2014-Dec-10)

* [only try to run tests for configuration groups with tests specified](https://github.com/busterjs/buster-test-cli/commit/a1b74d0)

**0.8.7** (2014-Dec-09)

* Fix for issue [#429 - No reporter prints `uncaughtException` details in case of browser tests](https://github.com/busterjs/buster/issues/429)

**0.8.6** (2014-Oct-22)

* [allowing autoRun to be overridden properly](https://github.com/busterjs/buster-test-cli/pull/15)

**0.8.5** (2014-Oct-21)

* New option `--fail-on-focus`to disable focus rocket [#327 - Command line switch to fail on focus rocket](https://github.com/busterjs/buster/issues/327)

**0.8.4** (2014-Sep-17)

* Fix for issue [#416 - buster-server crash with IE 11 on W7 only if there is two browsers captured](https://github.com/busterjs/buster/issues/416)

**0.8.3** (2014-May-05)

* Fix for issue [#376 - buster-test -t for hybrid tests](https://github.com/busterjs/buster/issues/376)
* Fix for issue [#384 - buster-test exit code is 1 though tests pass](https://github.com/busterjs/buster/issues/384)
* Fix for issue [#214 - BUSTER_REPORTER environment variable is not honoured?](https://github.com/busterjs/buster/issues/214)
* Fix for issue [#380 - Tests in multiple config groups should run more than once in node.js](https://github.com/busterjs/buster/issues/380)