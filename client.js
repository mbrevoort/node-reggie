#!/usr/bin/env node

var fs = require('fs')
  , util = require('util')
  , npm = require('npm')
  , pkginfo = require('pkginfo')(module)
  , request = require('request')
  , optimist = require('optimist')
  , prettyjson = require('prettyjson');
  ;

var argv = optimist
    .usage('reggie publish             --> Publish current module (from module root)\n' +
           'reggie info <package_name> --> Show JSON info about a particular package')
    .default({ u: 'http://127.0.0.1:8080'})
    .describe('u', 'The base URL of the Reggie server (e.g. http://reggie:8080)')
    .alias('u', 'url')
    .demand(['u'])
    .argv;

if (argv.h) {
  optimist.showHelp();
  process.exit(0);
}

argv.command = argv._[0];
argv.param1 = argv._[1];

var rootUrl = process.argv[3] || 'http://127.0.0.1:8080';

if (argv.command === 'publish') {
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
else if (argv.command === 'info' && argv.param1) {
  var url = argv.url + '/info/' + argv.param1;
  request({
    uri: url,
    json: true
  }, handleDataResponse)
}  
else if (argv.command === 'index') {
  var url = argv.url + '/index';
  request({
    uri: url,
    json: true
  }, handleDataResponse)
}  
else {
  optimist.showHelp();
}

function handleDataResponse (err, statusCode, body) {
  if (err) throw err;
  console.log(util.inspect(body, null, 20, true));
  console.log('done');
  process.exit(0);
}
