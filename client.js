#!/usr/bin/env node

var fs = require('fs')
  , npm = require('npm')
  , pkginfo = require('pkginfo')(module)
  , request = require('request');

var rootUrl = process.argv[3] || 'http://localhost:8080';

if (process.argv[2] === 'publish') {
  npm.load(null, function (err) {
    if (err) throw err;
    npm.commands.pack([], function (err, data, a, b) {
      if (err) throw err;

      // as described here: https://npmjs.org/api/pack.html
      var packagejson = JSON.parse(fs.readFileSync('package.json'));
      var name = packagejson.name;
      var version = packagejson.version
      var packageFile = name + '-' + version + '.tgz';
      var packageUrl = rootUrl + '/package/' + name + '/' + version;
      fs.createReadStream(packageFile).pipe(request.put(packageUrl, function (err, resp, body) {
        if (err) throw err;
        if (resp.statusCode === 200) {
          console.error('successfully published version ' + version + ' of ' + name + ': ' + packageUrl);
        }
        else {
          console.error('uh oh, something unexpected happened (' + resp.statusCode + ')');
        }
        fs.unlink(packageFile);
        console.log("done")
      }));
    });

  })
}
else {
  console.log("nothing to do :(")
}
//
