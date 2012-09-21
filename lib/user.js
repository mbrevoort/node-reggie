var fs = require('fs')
  , assert = require('assert')
  , path = require('path')
  , crypto = require("crypto");

module.exports = User;


function User (opts) {
  opts = opts || {};
  this._secret = opts.secret || "secret";
  this._usersFile = opts.path || path.join(process.cwd(), 'data', 'users.json');
  this._initSync();
}

User.prototype.authenticate = function (username, password, callback) {
  var self = this;
  self._open(function(err, data) {
    if (err) return callback.call(self, err);

    var expected = (data.users) ? data.users[username] : null;
    var hashedPassword = self._hashPasswordSync(password);

    if (expected && expected === hashedPassword) {
      return callback.call(self, null, true);
    }
    else {
      return callback.call(self, null, false);
    }
  });
};

User.prototype.setCredential = function (username, password, callback) {
  var self = this;
  self._open(function(err, data) {
    if (err) return callback && callback.call(self, err);

    data.users = data.users || {};
    data.users[username] = self._hashPasswordSync(password);

    self._save(data, function (err) {
      callback && callback.call(self, err);
    });
  });
};

User.prototype.deleteCredential = function (username, callback) {
  var self = this;
  self._open(function(err, data) {
    if (err) return callback.call(self, err);

    delete data.users[username];

    self._save(data, function (err) {
      callback.call(self, err);
    });
  });
};

User.prototype._hashPasswordSync = function (password) {
  var self = this;
  var hmac = crypto.createHmac('sha1', self._secret);
  hmac.update(password)
  return hmac.digest('base64');
};

//
// Open user file
// 
User.prototype._open = function (callback) {
  var self = this;

  fs.readFile(self._usersFile, function (err, data) {
    if (err) return callback.call(self, err);

    try {
      var users = JSON.parse(data);
      callback.call(self, null, users);
    }
    catch (err) {
      callback.call(self, err);
    }
  });  
};

//
// Save user file
//
User.prototype._save = function (updatedUsers, callback) {
  var self = this;
  var currentUsers = null;

  fs.readFile(self._usersFile, function (err, data) {
    if (err) return callback.call(self, err);

    try {
      currentUsers = JSON.parse(data);
    }
    catch (err) {
      callback.call(self, err);
    }

    // check that you have updated the most recent version
    // still a race condition but better than nothing
    if (currentUsers.version === updatedUsers.version) {
      updatedUsers.version++;
      fs.writeFile(self._usersFile, JSON.stringify(updatedUsers), function (err) {
        if (err) { 
          return callback.call(self, err);
        }
        else { 
          return callback.call(self, null, updatedUsers);
        }
      });

    }
    else {
      var error = new Error('Save rejected, not most recent (' + 
          currentUsers.version + ' !==' + updatedUsers.version + ')');
      callback.call(self, error);
    }
  });  
};

User.prototype._initSync = function () {
  var self = this;
  var initData = JSON.stringify({ users: {}, version: 0 });

  try {
    var data = fs.readFileSync(self._usersFile);
    var json = JSON.parse(data);
    assert(json.version >= 0);
    assert(json.users);
  }
  catch (err) {
    if (err.code === 'ENOENT') {
      fs.writeFileSync(self._usersFile, initData);
    }
    else {
      console.log("Problem with user JSON data file (" + self._usersFile + ")");
      console.log(err);
      throw err;
    }
  }
};
