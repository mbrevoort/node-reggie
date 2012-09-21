// Modules.
var User = require('../lib/user.js')
  , assert = require('assert')
  , path = require('path')
  , fs = require('fs')
  ;

describe('User module:', function () {

  describe ('Init new file:', function () {
    var userJsonFile = path.join('/tmp', Math.floor(Math.random()*4294967296).toString(36) + '.json');
    var user = null;

    before (function (done) {
      user = new User({
        path: userJsonFile
      });
      done();
    });

    it ('should find the file after initialization', function (done) {
      var stats = fs.statSync(userJsonFile);
      assert(stats.isFile());
      done();
    });

    it ('should have a 0 version', function (done) {
      var data = fs.readFileSync(userJsonFile);
      var json = JSON.parse(data);
      assert.equal(json.version, 0);
      done();
    });

    it ('should be properly structured', function (done) {
      var data = fs.readFileSync(userJsonFile);
      var json = JSON.parse(data);
      assert.equal('object', typeof json.users);
      assert.equal('number', typeof json.version);
      assert.equal(Object.keys(json).length, 2, 'should be nothing extra');
      done();
    });

    after (function (done) {
      fs.unlinkSync(userJsonFile);
      done();
    })
  });

  describe ('Init existing file:', function () {
    var userJsonFile = path.join('/tmp', Math.floor(Math.random()*4294967296).toString(36) + '.json');
    var user = null;

    // initialize first to make sure the file exists
    before(function (done) {
      new User({
        path: userJsonFile
      });

      user = new User({
        path: userJsonFile
      });

      done();
    });


    it ('should find the file after initialization', function (done) {
      var stats = fs.statSync(userJsonFile);
      assert(stats.isFile());
      done();
    });

    after (function (done) {
      fs.unlinkSync(userJsonFile);
      done();
    })
  });

  describe ("Credentials: ", function () {
    var userJsonFile = path.join('/tmp', Math.floor(Math.random()*4294967296).toString(36) + '.json');
    var user = null;

    // initialize first to make sure the file exists
    before (function (done) {
      user = new User({
        path: userJsonFile
      });

      done();
    });

    it ('should successfully authenticate with known credential', function (done) {
      user.setCredential('username1', 'password1', function (err) {
        assert.equal(null, err);
        user.authenticate('username1', 'password1', function (err, authenticated) {
          assert.equal(null, err);
          assert(authenticated);
          done();
        });
      });
    });

    it ('should fail authentication for incorrect password', function (done) {
      user.setCredential('username2', 'password2', function (err) {
        assert.equal(null, err);
        user.authenticate('username2', 'incorrect2', function (err, authenticated) {
          assert.equal(null, err);
          assert(!authenticated);
          done();
        });
      });
    });

    it ('should fail authentication for unknown credential', function (done) {
      user.authenticate('username3', 'password', function (err, authenticated) {
        assert.equal(null, err);
        assert(!authenticated);
        done();
      });
    });

    it ('should fail authentication after delete credential', function (done) {
      user.setCredential('username4', 'password4', function (err) {
        assert.equal(null, err);
        user.deleteCredential('username4', function (err) {
          assert.equal(null, err);
          user.authenticate('username4', 'password4', function (err, authenticated) {
            assert.equal(null, err);
            assert(!authenticated);
            done();
          });
        });
      });
    });


    after (function (done) {
      fs.unlinkSync(userJsonFile);
      done();
    })

  });


  describe ("Custom Secret: ", function () {
    var userJsonFile = path.join('/tmp', Math.floor(Math.random()*4294967296).toString(36) + '.json');
    var defaultUserJsonFile = path.join('/tmp', Math.floor(Math.random()*4294967296).toString(36) + '.json');
    var user = null;
    var defaultUser = null;
    var defaultHashedPassword = null;

    // initialize first to make sure the file exists
    before (function (done) {
      user = new User({
        path: userJsonFile,
        secret: "acustomsecret"
      });

      // set up a user with the default secret
      defaultUser = new User({
        path: defaultUserJsonFile
      });

      defaultUser.setCredential('username1', 'password1', function (err) {
        assert.equal(null, err);
        var data = fs.readFileSync(defaultUserJsonFile);
        var json = JSON.parse(data);
        defaultHashedPassword = defaultUser._hashPasswordSync('password1')
        assert(defaultHashedPassword !== null);
        done();
      });
    });

    it ('should have different hashed passwords', function (done) {
      user.setCredential('username1', 'password1', function (err) {
        assert.equal(null, err);

        var data = fs.readFileSync(userJsonFile);
        var json = JSON.parse(data);
        var hashedPassword = user._hashPasswordSync('password2')
        assert.notEqual(defaultHashedPassword, hashedPassword);
        done();
      });
    });

    it ('should successfully authenticate with known credential', function (done) {
      user.setCredential('username1', 'password1', function (err) {
        assert.equal(null, err);
        user.authenticate('username1', 'password1', function (err, authenticated) {
          assert.equal(null, err);
          assert(authenticated);
          done();
        });
      });
    });
    

    after (function (done) {
      fs.unlinkSync(userJsonFile);
      fs.unlinkSync(defaultUserJsonFile);      
      done();
    })

  });

});

