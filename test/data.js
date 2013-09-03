var expect = require('chai').expect;
var helpers = require('./helpers.js');
var rewire = require('rewire');
var Data = rewire('../lib/data.js');

// we stub out the fs unlink method so we just call
// the callback function as if it unlinked successfully
Data.__set__('fs', {
  unlink: function(path, callback) { callback(); }
});

describe('reggie is initialized with one package', function() {
  var registryData, pkg;

  before(function() {
    registryData = new Data();
    registryData._packageMap = {
      'test-pkg' : {
        versions: {
          '0.0.1' : {
            data: {
              name: 'test-pkg',
              version: '0.0.1',
              _id: 'test-pkg@0.0.1'
            },
            pathToPackage: 'sandbox/test.tar.gz'
          }
        }
      }
    };
  });

  it('Data.index should report 1 package', function() {
    var packages = registryData.index();
    expect(packages).to.be.length(1);
  });

  it('Data.deletePackage should delete the package', function(done) {
    registryData.deletePackage('test-pkg', '0.0.1', function() {
      var packages = registryData.index();
      expect(packages).to.be.length(0);

      done();
    });
  });
});