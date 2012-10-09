#!/usr/bin/env node

var restify = require('restify')
  , fs = require('fs')
  , tar = require('tar')
  , zlib = require('zlib')
  , path = require('path')
  , rimraf = require('rimraf')
  , mkdirp = require('mkdirp')
  , semver = require('semver')
  , optimist = require('optimist');

// ----------------------------------------------------------------------------
// options parsing
// ----------------------------------------------------------------------------

var argv = optimist
    .usage('Reggie wants to serve your packages!\nUsage: $0')
    //.demand(['d'])
    .default({ d : path.join(process.cwd(), 'data'), p : 8080 })
    .alias('d', 'data')
    .alias('p', 'port')
    .alias('h', 'help')
    .describe('d', 'Directory to store Reggie\'s data')
    .describe('p', 'Reggie\'s a good listener. What port should I listen on?')
    .argv;

if (argv.h) {
  optimist.showHelp();
  process.exit(0);
}


// ----------------------------------------------------------------------------
// data initialization
// ----------------------------------------------------------------------------

var Data = require('./lib/data');
var data = new Data({ dataDirectory: argv.data });
data.init(function (err) {
  console.log("Starting to load packages in " + data._packagesDir);
  data.reloadPackages(function (err) {
    if (err) throw err;
    console.log("Done auto-loading packages")
  });
});

// ----------------------------------------------------------------------------
// server wireup
// ----------------------------------------------------------------------------

var server = restify.createServer();

server.get('/', function (req, res) {
  res.send('Reggie says hi')
});

server.put('/package/:name/:version', function (req, res, next) {
  var name = req.params.name;
  var version = req.params.version;
  var rand = Math.floor(Math.random()*4294967296).toString(36);
  var tempPackageFile = path.join(argv.data, "temp", rand + name + "-" + version + ".tgz");

  // write the tar file. Don't combine the streamed gzip and untar on upload just yet...
  req
    .on('end', function () { 
      data.loadPackage(tempPackageFile, name, version, function (err) {
        if (err) {
          console.error("Error loading package from upload: " + (err.message || err));
          fs.unlink(tempPackageFile);
          return res.send(err, 500);
        }

        fs.unlink(tempPackageFile);
        res.send(200);
      });
    })
    .pipe(fs.createWriteStream(tempPackageFile))
    .on('error', function (err) {
      console.error("Unexpected error when accepting package upload: " + (err.message || err));
      fs.unlink(tempPackageFile);
      res.send(err, 500);
    });

});  

server.get('/versions/:name', function (req, res) {
  var name = req.params.name;
  res.send(data.whichVersions(name));
});

server.get('/package/:name/:range', function (req, res, next) {
  var name = req.params.name;
  var range = req.params.range;
  if (range === 'latest') 
    range = 'x.x.x';
  returnPackageByRange(name, range, res);
});

server.get('/index', function (req, res) {
  res.send(data.index());
});

server.get('/info/:name', function (req, res) {
  var name = req.params.name;  
  var meta = data.packageMeta(name);
  if (!meta) return res.send(404);
  else return res.send(meta);
});

server.listen(argv.port, function() {
  console.log('Reggie listening at %s', server.url);
});

// ----------------------------------------------------------------------------
// register permutations of gt,lt,gte,lte routes for semver magic 
// ----------------------------------------------------------------------------

var ops = [['gt', '>'], ['lt', '<'], ['gte', '>='], ['lte', '<=']]

ops.forEach(function (op1) {
  //console.log (op1);
  registerOp(op1);
  ops.forEach(function (op2) {
    if (op1 != op2) {
      //console.log(op1, op2);
      registerOp(op1, op2);
    }
  })
})

function registerOp (op1, op2) {
  if (!op2) {
    //console.log('/package/:name/' + op1[0] + '/:v1')
    server.get('/package/:name/' + op1[0] + '/:v1', function (req, res, next) {
      var name = req.params.name;
      var v1 = req.params.v1;
      var range = op1[1] + v1;
      returnPackageByRange(name, range, res);
    });    
  }
  else {
    //console.log('/package/:name/' + op1[0] + '/:v1/' + op2[0] + '/:v2')
    server.get('/package/:name/' + op1[0] + '/:v1/' + op2[0] + '/:v2', function (req, res, next) {
      var name = req.params.name;
      var v1 = req.params.v1;
      var v2 = req.params.v2;
      var range = op1[1] + v1 + ' ' + op2[1] + v2;
      returnPackageByRange(name, range, res);
    });    

  }
}

function returnPackageByRange (name, range, res) {
  var version = semver.maxSatisfying(data.whichVersions(name), range);
  console.log("semver range calculation of (" + name, range + ")  ==> ", version);

  if (!version) { 
    return res.send(404) 
  }

  var filename = name + '-' + version + '.tgz';
  res.contentType = 'application/x-compressed';
  res.header( "Content-Disposition", "filename=" + filename );

  data.openPackageStream(name, version, function (err, stream) {
    if (err) {
      console.error("Error streaming package: " + (err.message || err));
      res.send(err, 500);
    }
    stream
      .pipe(res)
      .on('error', function (err) {
        res.send(err, 500);
      });
  })
}


