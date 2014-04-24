var debug = require('debug')('test');
var expect = require('chai').expect;

var helpers = require('./helpers.js');

describe('reggie npm server', function() {
  this.timeout(5000);
  before(helpers.prepareSandbox);
  before(helpers.startReggieServer);
  after(helpers.stopReggieServer);

  it('publishes a package that does not exist yet', function(done) {
    var npmConfig = {
      // verify that we can publish without AuthSession cookie
      // (yes, this test verifies two things)
      _token: undefined
    };

    var pkg = helpers.givenAPackage();

    helpers.runNpmInDirectory(
      pkg.folder,
      ['publish'],
      expectPackageWasPublished(done, pkg.nameAtVersion)
    );
  });

  it('renews AuthSession when the session is expired', function(done) {
    // This test verifies that 'GET /_session' renews AuthSession cookie.
    // We are testing it in context of `npm publish` because that's
    // what matters.

    var npmConfig = {
      _token: helpers.anExpiredAuthToken()
    };

    var pkg = helpers.givenAPackage();

    helpers.runNpmInDirectory(
      pkg.folder,
      ['publish'],
      npmConfig,
      expectPackageWasPublished(done, pkg.nameAtVersion)
    );
  });

  it('searches for a package that does not exist', function(done) {
    // This test verifies that searching for a package which does not
    // exist returns no results.
    var pkg = helpers.givenAPackage();

    // Ensure there are no previous search results in the cache
    // to prevent npm from using stale data.
    helpers.cleanNpmCache();

    helpers.runNpmInDirectory(
      pkg.folder,
      ['search', pkg.nameAtVersion],
      expectPackageNotFoundInSearch(done, pkg.nameAtVersion)
    );
  });

  it('searches for a package that is already published', function(done) {
    // This test verifies that searching for a package which is
    // published return the correct search result.
    var pkg = helpers.givenAPackage();

    // Ensure there are no previous search results in the cache
    // to prevent npm from using stale data.
    helpers.cleanNpmCache();

    helpers.runNpmInDirectory(
      pkg.folder,
      ['publish'],
      function(err, stdout, stderr) {
        if (err) return done(err);
        // Give Reggie server some time to process the published package,
        // because the response is sent before the processing is done
        setTimeout(function() {
          helpers.runNpmInDirectory(
            pkg.folder,
            ['search', pkg.name],
            expectPackageFoundInSearch(done, pkg.name)
          );
        }, 200);
      }
    );
  });

  it('publishes a package with just name', function(done){
    var pkg = helpers.givenAPackage();
    helpers.cleanNpmCache();
    helpers.runNpmInDirectory(
      pkg.folder,
      ['publish'],
      function(err, stdout, stderr){
        if (err) return done(err);
        setTimeout(function(){
          helpers.runNpmInDirectory(
            pkg.folder,
            ['search', pkg.name],
            expectPackageFoundInSearch(done, pkg.nameAtVersion)
          );
        }, 200);
      }
    );
  });
});

function expectPackageWasPublished(done, nameAtVersion) {
  return function(err, stdout, stderr) {
    if (err) done(err);
    expect(stdout.trim()).to.equal('+ ' + nameAtVersion);
    done();
  };
}

function expectPackageNotFoundInSearch(done, nameAtVersion) {
  return function(err, stdout, stderr) {
    if (err) done(err);
    expect(stdout.trim()).to.have.string('No match found for "' + nameAtVersion + '"');
    done();
  };
}

function expectPackageFoundInSearch(done, nameAtVersion) {
  return function(err, stdout, stderr) {
    if (err) done(err);
    expect(stdout.trim()).to.not.have.string('No match found for "' + nameAtVersion + '"');
    done();
  };
}
