#!/usr/bin/env node

var restify = require('restify')
  , Cookies = require('cookies')
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

// TODO - add option for setting host
var argv = optimist
    .usage('Reggie wants to serve your packages!\nUsage: $0')
    //.demand(['d'])
    .default({ d : path.join(process.cwd(), 'data'), p : 8080 })
    .alias('d', 'data')
    .alias('p', 'port')
    .alias('u', 'url')
    .alias('h', 'help')
    .describe('d', 'Directory to store Reggie\'s data')
    .describe('p', 'Reggie\'s a good listener. What port should I listen on?')
    .describe('u', 'URL where `npm` can access registry (usually http://{hostname}:{port}/)')
    .argv;

if (argv.h) {
  optimist.showHelp();
  process.exit(0);
}


// ----------------------------------------------------------------------------
// data initialization
// ----------------------------------------------------------------------------

var config = {
  dataDirectory: argv.data,
  registryUrl: normalizeUrl(argv.url || 'http://localhost:' + argv.p + '/')
}

var Data = require('./lib/data');
var data = new Data(config);

data.init(function (err) {
  console.log("Starting to load packages in " + data._packagesDir);
  data.reloadPackages(function (err) {
    if (err) throw err;
    console.log("Done auto-loading packages")
  });
});

function normalizeUrl(url) {
  if (url.match(/\/$/))
    return url;
  return url + '/';
}

// ----------------------------------------------------------------------------
// server wireup
// ----------------------------------------------------------------------------

var server = restify.createServer();

server.use(restify.bodyParser());

server.get('/', function (req, res) {
  res.send('Reggie says hi')
});

server.put('/package/:name/:version', function (req, res, next) {
  var name = req.params.name;
  var version = req.params.version;
  var rand = Math.floor(Math.random()*4294967296).toString(36);
  var tempPackageFile = path.join(argv.data, "temp", rand + name + "-" + version + ".tgz");

  // write the tar file. Don't combine the streamed gzip and untar on upload just yet...
  fs.writeFile(tempPackageFile, req.body, function(err) {
    if (err) {
      console.error("Unexpected error when accepting package upload: " + (err.message || err));
      return res.send(500, err);
    }

    data.loadPackage(tempPackageFile, name, version, function (err) {
      if (err) {
        console.error("Error loading package from upload: " + (err.message || err));
        fs.unlink(tempPackageFile);
        return res.send(500, err);
      }

      fs.unlink(tempPackageFile);
      res.send(200);
    });
  });
});

server.del('/package/:name/:version', function (req, res, next) {
  var name = req.params.name;
  var version = req.params.version;

  data.deletePackage(name, version, function (err) {
    if (err) {
      console.error("Error deleting package " + name + "@" + version + ": " + (err.message || err));
      return res.send(500, err);
    }
    res.send(200);
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

// ----------------------------------------------------------------------------
// NPM registry protocol
// ----------------------------------------------------------------------------


server.get('/-/all/since', listAction);
server.get('/-/all', listAction);

server.put('/:name', function (req, res) {
  // TODO verify that req.params.name is the same as req.body.name
  data.updatePackageMetadata(req.body);
  res.json(200, { ok: true });
});

function notFound(res) {
  return res.json(404, { error: "not_found", reason: "document not found" });
}

server.get('/:name', function (req, res) {
  var packageName = req.params.name;
  var meta = data.packageMeta(packageName);
  if (!meta) return notFound(res);

  var versions =  data.whichVersions(packageName).sort();
  var versionsData = {};
  var times = {};
  versions.forEach(function(v) {
    versionsData[v] = meta.versions[v].data;
    times[v] = meta.versions[v].time;
  });

  var result = {
    _id: packageName,
    _rev: '1-0',
    name: meta.name,
    description: meta.description,
    'dist-tags': {
      latest: versions[versions.length-1]
    },
    versions: versionsData,
    maintainers: [],
    author: meta.author,
    repository: meta.repository,
    time: times
  };
  res.json(200, result);
});

server.get('/:name/:version', function (req, res) {
  var name = req.params.name;
  var version = req.params.version;

  var meta = data.packageMeta(name);
  if (!meta) return notFound(res);

  var versionMeta = meta.versions[version];
  if (!versionMeta) return notFound(res);

  res.json(200, versionMeta.data);
});

function listAction(req, res) {
  var result = {
    _updated: 0
  };

  data.getAllPackageNames()
    .forEach(function(name) {
      result[name] = getPackageInfo(name);
    });

  res.json(200, result);

  function getPackageInfo(packageName) {
    var versions =  data.whichVersions(packageName).sort();
    var meta = data.packageMeta(packageName);
    var lastVersion = versions[versions.length-1];
    var versionsData = {};
    versions.forEach(function(v) {
      versionsData[v] = 'latest';
    });

    return {
      _id: meta.name,
      name: meta.name,
      description: meta.description,
      'dist-tags': {
        latest: lastVersion
      },
      versions: versionsData,
      maintainers: [],
      author: meta.author,
      repository: meta.repository,
      time: {
        modified: meta.versions[lastVersion].time
      }
    };
  }
}

server.put('/:name/-/:filename/-rev/:rev', function (req, res) {
  var filename = req.params.filename;
  var rand = Math.floor(Math.random()*4294967296).toString(36);
  var tempPackageFile = path.join(argv.data, "temp", rand + '-' + filename);
  fs.writeFile(tempPackageFile, req.body, function(err) {
    if (err) {
      console.log('Cannot save package to a temp file %s: %s', tempPackageFile, err.message);
      return res.json(500, { error: 'internal_server_error', reason: err.toString() });
    }
    data.loadPackage(tempPackageFile, function(err) {
      if (err) {
        console.error('Error loading package from upload: ' + (err.message || err));
        fs.unlink(tempPackageFile);
        return res.json(400, { error: 'bad_request', reason: 'package file cannot be read'});
      }
      return res.json(201, {
        ok: true,
        id: '-',
        rev: '1-0'
      });
    });
  });
});

server.put('/:name/:version/-tag/:tag', function(req, res) {
  res.json(201, {
    ok: true,
    id: req.params.tag,
    rev: '1-0'
  });
});

server.get('/:name/-/:file', function(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/octet-stream'});
  fs.createReadStream(path.join(data._packagesDir, req.params.file))
    .pipe(res);
});


function fix(path) {
  return {
    path: path,
    urlParamPattern: '([a-zA-Z0-9-_~\\.%@:]+)' // added ':' to the white-list
  };
}

server.put(fix('/-/user/:user'), function(req, res) {
  res.json(201, {
    ok: true,
    id: req.params.user,
    rev: '1-0'
  });
});

server.post('/_session', function(req, res) {
  // TODO - verify login & password

  var cookies = new Cookies(req, res);
  // refresh auth session in the client or set a new 'dummy' one
  cookies.set('AuthSession', cookies.get('AuthSession') || 'dummy');

  res.json(200, {
    ok: true,
    name: req.body.name,
    roles: []
  });
});

/* Middleware for logging all incoming requests *
server.pre(function (req, res, next) {
  console.log('< %s %s', req.method, req.url);
  console.log(JSON.stringify(req.headers, null, 2));
  console.log('> %s %s', res.statusCode, res.statusText);
  console.log();
  next();
});
/**/

server.listen(argv.port, function() {
  console.log('Reggie listening at %s', server.url);
  console.log('NPM registry URL:\n  %s\n', config.registryUrl);
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
      res.send(500, err);
    }
    stream
      .pipe(res)
      .on('error', function (err) {
        res.send(500, err);
      });
  })
}


