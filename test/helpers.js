var child_process = require('child_process');
var extend = require('util')._extend;
var fs = require('fs');
var path = require('path');

var debug = require('debug')('reggie');
var ini = require('ini');

exports.SANDBOX = path.resolve(__dirname, 'sandbox');
exports.reggieUrl = undefined;

exports.givenDummyPackage = givenDummyPackage;
exports.runNpmInDirectory = runNpmInDirectory;
exports.startReggieServer = startReggieServer;
exports.stopReggieServer = stopReggieServer;
exports.rmtreeSync = rmtreeSync;
exports.prepareSandbox = prepareSandbox;

/**
 * Create a dummy package and return the folder where the package was created.
 * @param {Object} packageJson Optional package description
 * @returns {string}
 */
function givenDummyPackage(packageJson) {
  var defaults = {
    "name": "test-module",
    "version": "0.1.0",
    "description": "a test module",
    "main": "index.js",
    "author": "me",
    "license": "BSD"
  };

  packageJson = extend(defaults, packageJson);

  var pkgDir = path.join(exports.SANDBOX, packageJson.name);
  rmtreeSync(pkgDir);
  fs.mkdirSync(pkgDir);

  var jsonFile = path.join(pkgDir, 'package.json');
  fs.writeFileSync(jsonFile, JSON.stringify(packageJson, null, 2));

  var indexFile = path.join(pkgDir, 'index.js');
  fs.writeFileSync(indexFile, '// empty');

  return pkgDir;
}

/**
 * Run `npm` in `dir` with a given user `config` and command-line `args`.
 * @param {string} cwd
 * @param {Array.<string>} args
 * @param {Object|function} config (optional)
 * @param {function(Error,string,string)|undefined} callback with error,
 *   stdout, stderr
 */
function runNpmInDirectory(cwd, args, config, callback) {
  if (!callback && typeof(config) == 'function') {
    callback = config;
    config = {};
  }

  config = extend({
    _auth: 'ZHVtbXk6cGFzcw==', // dummy:pass
    email: 'dummy@example.org'
  }, config);

  debug('config: %j', config);

  var npmConfigFile = path.join(exports.SANDBOX, 'npm-config.ini');
  fs.writeFileSync(npmConfigFile, ini.stringify(config, null, 2));

  var env = {
    PATH: process.env.PATH,
    NODE: process.env.NODE,
    npm_config_userconfig: npmConfigFile
  };

  args = [ '--registry=' + exports.reggieUrl ].concat(args);
  var command = ['npm'].concat(args).join(' ');

  debug('executing `%s` in %s with env %j', command, cwd, env);

  child_process.exec(
    command,
    { cwd: cwd, env: env },
    function (err, stderr, stdout) {
      debug('done (%s)', err || 'ok');
      callback(err, stderr, stdout);
    }
  );
}

/*== Reggie server helpers ==*/

var reggieProcess;

function startReggieServer(done) {
  var fileStorage = path.join(exports.SANDBOX, 'reggie-storage');
  rmtreeSync(fileStorage);

  var reggiePath = path.resolve(__dirname, '..', 'server.js');
  var args = [ reggiePath,  '-d', fileStorage, '-p', '0' ];
  reggieProcess = child_process.spawn(process.execPath, args);

  process.on('exit', function() {
    stopReggieServer();
  });

  reggieProcess.stdout.on('data', function(data) {
    var match = data.toString().match(/Reggie listening at http:\/\/0.0.0.0:(\d+)/);
    if (!match) return;
    exports.reggieUrl = 'http://localhost:' + match[1] + '/';
    debug('Test registry listening at %s', exports.reggieUrl);
    done();
  });

  reggieProcess.stderr.on('data', function(data) {
    debug(data.toString());
  });
}

function stopReggieServer(done) {
  if (reggieProcess == null) return;
  debug('Stoppping reggie server...');
  reggieProcess.kill();
  reggieProcess.on('exit', function() { done(); });
  reggieProcess = null;
}

function prepareSandbox() {
  rmtreeSync(exports.SANDBOX);
  fs.mkdirSync(exports.SANDBOX);
}

/**
 * Recursively deletes a directory tree if it exists.
 * @param dir Directory or file name to delete.
 */
function rmtreeSync(dir) {
  try {
    var stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
      fs.unlinkSync(dir);
      return;
    }
  } catch (err) {
    if (err.code == 'ENOENT') return;
    throw err;
  }

  var list = fs.readdirSync(dir);
  for (var i = 0; i < list.length; i++) {
    var filename = path.join(dir, list[i]);
    rmtreeSync(filename);
  }
  fs.rmdirSync(dir);
}

