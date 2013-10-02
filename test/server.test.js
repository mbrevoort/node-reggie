'use strict';

var proxyquire = require('proxyquire'),
    expect = require('chai').expect,
    sinon = require('sinon');

var VERBS = ['get', 'post', 'put', 'del'];

describe('reggie npm server (unit)', function () {
  var reggieServer,
      req = {},
      res = {},
      routes = {},
      restify = {},
      data = function Data() {};

  var versions = [
    '1.0.0',
    '1.0.1',
    '1.0.2-2',
    '1.0.2-10'
  ]
  data.prototype.packageMeta = function () {
    return {
      versions: versions.reduce(function (verObj, currVer) {
        verObj[currVer] = {data: {}, time: {}};
        return verObj;
      }, {})
    };
  };
  data.prototype.whichVersions = function () {
    return versions;
  };

  beforeEach(function () {
    //Store route functions in a hash
    VERBS.forEach(function (verb) { routes[verb] = {}; });

    //mock restify
    restify.createServer = function() {
      var serverMock = {
        'use': function () {},
        'listen': function () {}
      };
      VERBS.forEach(function (verb) {
        serverMock[verb] = function (route, cb) {
          routes[verb][route] = cb;
        };
      });
      return serverMock;
    };

    data.prototype.init = function () {};

    reggieServer = proxyquire('../server', {
      'restify': restify,
      './lib/data': data
    });

    req.params = {
      name: 'test'
    };

    res.json = sinon.spy();
  });

  describe('/:name', function () {
    it('Should choose "latest" by semver order', function () {
      routes.get['/:name'](req, res);
      expect(res.json.firstCall.args[1]['dist-tags'].latest).to.equal('1.0.2-10');
    });
  });

  describe('/-/all', function () {
    it('Should choose "latest" by semver order', function () {      
      data.prototype.getAllPackageNames = function () {
        return ['test'];
      };
      routes.get['/-/all'](req, res);
      console.log(res.json.firstCall.args[1]);
      expect(res.json.firstCall.args[1].test['dist-tags'].latest).to.equal('1.0.2-10');
      expect(res.json).to.haveBeenCalled;
    });
  });
});