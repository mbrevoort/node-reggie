var path = require('path')
  , fs = require('fs')
  , tar = require('tar')
  , zlib = require('zlib')
  , crypto = require('crypto')
  , mkdirp = require('mkdirp')
  , rimraf = require('rimraf')
  , async = require('async')
  , readJson = require('read-package-json');

module.exports = Data;


function Data (opts) {
  opts = opts || {};

  // directories
  this._rootDir = opts.dataDirectory || path.join(process.cwd(), 'data');
  this._packagesDir = path.join(this._rootDir, 'packages');
  this._jsonDir = path.join(this._rootDir, 'json');
  this._tempDir = path.join(this._rootDir, 'temp');

  this._packageMap = {}
};

Data.prototype.init = function (callback) {
  var self = this;
  async.series([
    function (cb) { mkdirp(self._packagesDir, cb) },
    function (cb) { mkdirp(self._jsonDir, cb) },
    function (cb) { mkdirp(self._tempDir, cb) },
  ], callback);
}

Data.prototype.addPackage = function (pathToPackage, callback) {

};

//
// Load all package from the _packagesDir
//
Data.prototype.reloadPackages = function (callback) {
  var self = this;
  var concurrency = 25;

  var q = async.queue(function (file, cb) {
    self.loadPackage (file, cb);
  }, concurrency);

  fs.readdir(this._packagesDir, function (err, files) {
    files = (!files) ? [] : files.map(function(file) { return path.join(self._packagesDir, file) });
    if (files.length > 0)
      q.push(files);
    else
      callback.call();
  });

  if (callback) { q.drain = callback }
}

//
// Load a package from a path
// expectec=d name and version optional
//
Data.prototype.loadPackage = function (pathToPackage, expectedName, expectedVersion, callback) {
  var self = this;

  if (typeof expectedName === 'function') {
    callback = expectedName;
    expectedName = expectedVersion = undefined;
  }

  // make a temp directory to extract each package
  self._makeTempDir(function (err, dir) {
    if (err) {
      console.error("Data.loadPackage: Failed to make directory " + dir);
      throw err;
    }

    // unzip and extract
    fs.createReadStream(pathToPackage)
      .pipe(zlib.createGunzip())
      .on('error', function (err) {
        console.error("Data.loadPackage: Error unzipping package " + pathToPackage)
        return callback && callback.call(undefined, err);
      })
      .pipe(tar.Extract({ path: dir }))
      .on('error', function (err) {
        console.error("Data.loadPackage: Error untarring package " + pathToPackage)
        return callback && callback.call(undefined, err);
      })
      .on('end', function () { 
        var pJsonPath = path.join(dir, 'package/package.json');
        readJson(pJsonPath, function (err, pjsonData) {
          if (err) {
            console.error("Data.loadPackage: Error loading package.json " + pJsonPath + ' for ' + pathToPackage);
            return callback && callback.call(undefined, err);
          }

          // we don't need it anymore, destroy our temp directory out of band
          self._destroyDir(dir);

          // TODO do something with the package.json data
          var name = pjsonData.name;
          var version = pjsonData.version;
          var expectedPackagePath = path.join(self._packagesDir, name + '-' + version + '.tgz');

          // check that the packaged we received is what we expect
          if (expectedName && expectedVersion && (expectedName !== name || expectedVersion !== version)) {
            return callback(new Error("Package rejected, expected " + expectedName + "@" + expectedVersion 
                                      + ", received " + name + "@" + version));
          }

          // TODO: do this after writes confirmed
          self._registerPackage(pjsonData, expectedPackagePath);

          // is package under our _packagesDir?
          if (path.dirname(pathToPackage) === self._packagesDir) {
            // is it named as expected?
            if (expectedPackagePath === pathToPackage) {
              return callback && callback.call();
            }
            else {
              // move it
              return self._mv(pathToPackage, expectedPackagePath, callback);
            }
          }
          else {
            // copy it
            return self._cp(pathToPackage, expectedPackagePath, callback);
          }
        });
      })
  });
}

Data.prototype.deletePackage = function (name, version, callback) {
  var self = this;

  this._findPackage(name, version, function (error, pkg) {
    if (error) {
      return callback.call(undefined, error);
    }

    // delete the package
    fs.unlink(pkg.pathToPackage, function (error) {
      if (error) {
        return callback.call(undefined, error);
      }

      var pkg = self._packageMap[name];
      var versions = pkg.versions || {};
      delete versions[version];
      callback.call(undefined, null);
    })
  });
}

Data.prototype.openPackageStream = function (name, version, callback) {
  this._findPackage(name, version, function (error, pkg) {
    if (error) {
      callback.call(undefined, error);
    }
    else {
      callback.call(undefined, null, fs.createReadStream(pkg.pathToPackage));
    }
  });
}

// TODO make api async
Data.prototype.whichVersions = function (name) {
  var pkg = this._packageMap[name];
  var versions = pkg.versions || {};
  return (pkg) ? Object.keys(versions) : [];
}

// TODO make api async
Data.prototype.packageMeta = function (name) {
  var pkg = this._packageMap[name];
  return pkg;
}

// TODO make api async
Data.prototype.index = function () {
  var self = this;
  var list = [];
  var pkgNames = Object.keys(self._packageMap);
  pkgNames.forEach(function (name) {
    var versions = self.whichVersions(name).sort().reverse();
    var version = versions[0];
    var pkgVersions = Object.keys(self._packageMap[name].versions);
    var pkg = self._packageMap[name].versions[version];
    list.push({
      name: pkg.data.name,
      description: pkg.data.description,
      author: pkg.data.author,
      version: version,
      versions: versions
    });
  });
  return list;
}

Data.prototype._registerPackage = function (pjsonData, pathToPackage) {
  var self = this;
  var name = pjsonData.name;
  var version = pjsonData.version;
  var pkg = self._packageMap[name] = self._packageMap[name] || {};

  pkg.name = pjsonData.name;
  pkg.description = pjsonData.description;
  pkg.author = pjsonData.author;
  pkg.repository = pjsonData.repository;
  pkg.dependencies = pjsonData.dependencies;
  pkg.readme = pjsonData.readme;
  pkg.versions = pkg.versions || {};

  pkg.versions[version] = {
    data: pjsonData,
    pathToPackage: pathToPackage
  };
  console.log("Registered package " + name + "@" + version);
}

Data.prototype._findPackage = function (name, version, callback) {
  var pkg = this._packageMap[name];
  var versions = pkg.versions || {};
  if (!pkg) return callback.call(undefined, new Error(name + " package not found"));
  var pkgVersion = versions[version];
  if (!pkgVersion) return callback.call(undefined, new Error(name + "@" + version + " package not found"));
  var pathToPackage = pkgVersion.pathToPackage;
  if (!pathToPackage) return callback.call(undefined, new Error(name + "@" + version + " package missing"));
  return callback.call(undefined, null, pkgVersion);
}

Data.prototype._makeTempDir = function (callback) {
  var size = 16;
  var self = this;
  crypto.randomBytes(size, function(ex, buf) {
    var dir = path.join(self._tempDir, buf.toString('hex'));
    mkdirp(self._packagesDir , function (err) {
      callback (err, dir);
    });
  });
}

Data.prototype._destroyDir = function (dir, callback) {
  callback = callback || function (){}; 
  rimraf(dir, callback);
}

Data.prototype._cp = function (from, to, callback) {
  fs.createReadStream(from)
    .on('end', function () {
      return callback && callback.call();
    })
    .pipe(fs.createWriteStream(to))
    .on('error', callback);
}

Data.prototype._mv = function (from, to, callback) {
  fs.rename(from, to, callback);
}



// data
// var db = {
//   packages: {}
// };

// function registerPackage (name, version) {
//   var pkg = db.packages[name] = db.packages[name] || {};
//   pkg[version] = true;
//   console.log(db);
// }

// function registerPackage (name, version) {
//   var pkg = db.packages[name] = db.packages[name] || {};
//   pkg[version] = true;
//   console.log(db);
// }

// self.loadPackages = function loadPackages() {
//   fs.readdir(jsonDirectory, function (err, files) {
//     files.forEach(function (file) {
//       console.log(file);
//       fs.readFile(jsonDirectory + '/' + file, function (err, data) {
//         var json = JSON.parse(data);
//         registerPackage (json.name, json.version);
//       });
//     });
//   })
// }

// self.versions = function versions (name) {
//   var pkg = db.packages[name] = db.packages[name] || {};
//   return Object.keys(pkg);  
// }
