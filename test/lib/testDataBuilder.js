var proxyquire = require('proxyquire'),
  Data = proxyquire('../../lib/data.js',
    {
      'fs' : {
        unlink: function(path, callback) {
          callback();
        }
      }
    });

function givenData() {
  return new Data();
}

function givenDataWithSinglePackageVersion(name, version) {
  if (name === undefined) name = 'test-package';
  if (version === undefined) version = 'test-version';

  var registryData = new Data();

  var packageVersion = {
      data: {
        name: name,
        version: version,
        _id: name + '@' + version
      },
      pathToPackage: 'sandbox/test.tar.gz'
    },
    package = {
      versions: {}
    };

  package.versions[version] = packageVersion;
  registryData._packageMap[name] = package;

  return registryData;
}

module.exports = {
  givenDataWithSinglePackageVersion: givenDataWithSinglePackageVersion,
  givenData: givenData
};