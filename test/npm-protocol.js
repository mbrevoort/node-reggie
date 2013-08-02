var debug = require('debug')('reggie');
var expect = require('chai').expect;

var helpers = require('./helpers.js');

describe('reggie npm server', function() {
  before(helpers.prepareSandbox);
  before(helpers.startReggieServer);
  after(helpers.stopReggieServer);

  it('publishes package that does not exist yet', function(done) {
    var packageFolder = helpers.givenDummyPackage(
      { name: 'dummy',
        version: '0.1.0'
      }
    );

    helpers.runNpmInDirectory(
      packageFolder,
      ['publish'],
      expectPackageWasPublished(done)
    );
  });
});

function expectPackageWasPublished(done) {
  return function(err, stdout, stderr) {
    if (err) done(err);
    debug(stderr.toString());
    expect(stdout.toString().trim()).to.equal('+ dummy@0.1.0');
    done();
  };
}
