var expect = require('chai').expect,
  testDataBuilder = require('./lib/testDataBuilder.js');

describe('Data', function() {
  describe('index()', function() {
    it('reports one package', function() {
      var registryData = testDataBuilder.givenDataWithSinglePackageVersion();
      var packages = registryData.index();
      expect(packages).to.be.length(1);
    });
  });

  describe('deletePackage()', function() {
    it('deletes the package', function(done) {
      var registryData = testDataBuilder.givenDataWithSinglePackageVersion('test-pkg', '0.0.1');

      registryData.deletePackage('test-pkg', '0.0.1', function() {
        var packages = registryData.index();
        expect(packages).to.be.length(0);
        done();
      });
    });
  });
});