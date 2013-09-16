var expect = require('chai').expect,
  helpers = require('./helpers.js'),
  proxyquire = require('proxyquire'),
  Data = proxyquire('../lib/data.js',
  {
    'fs' : {
      unlink: function(path, callback) {
        callback();
      }
    }
  });

describe('Data', function() {
  describe('index()', function() {
    it('reports one package', function() {
      var registryData = new Data();
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

      var packages = registryData.index();
      expect(packages).to.be.length(1);
    });
  });

  describe('deletePackage()', function() {
    it('deletes the package', function(done) {
      var registryData = new Data();
      registryData._packageMap = {
        'test-pkg' : {
          versions: {
            '0.0.1' : {
              data: {
                name: 'test-pkg',
                version: '0.0.1'
              },
              pathToPackage: 'sandbox/test.tar.gz'
            }
          }
        }
      };

      registryData.deletePackage('test-pkg', '0.0.1', function() {
        var packages = registryData.index();
        expect(packages).to.be.length(0);
        done();
      });
    });
  });
});