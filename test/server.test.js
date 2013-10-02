'use strict';

var proxyquire = require('proxyquire'),
    expect = require('chai').expect,
    sinon = require('sinon'),
    semver = require('semver');

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
  ];
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

    req.params = { name: 'test' };
    res.json = sinon.spy();
  });

  describe('/:name', function () {
    beforeEach(function () {
      routes.get['/:name'](req, res);
    });

    it('Should choose latest by semver order', function () {
      expect(res.json.firstCall.args[1]['dist-tags'].latest).to.equal('1.0.2-10');
    });

    it('Should "sort" by semver order', function () {
      // Yes, this is depending on an implementation detail of Object.keys
      // Yes, that violates the API contract of Object and is bad
      // Yes, this is how the npm client actually works
      var resultVersions;
      resultVersions = Object.keys(res.json.firstCall.args[1].versions);
      expect(resultVersions).to.deep.equal(versions.sort(semver.compare));
    });
  });

  describe('/-/all', function () {
    beforeEach(function () {
      data.prototype.getAllPackageNames = function () {
        return ['test'];
      };
      routes.get['/-/all'](req, res);
    });

    it('Should choose "latest" by semver order', function () {      
      expect(res.json.firstCall.args[1].test['dist-tags'].latest).to.equal('1.0.2-10');
    });

    it('Should "sort" by semver order', function () {
      // Yes, this is depending on an implementation detail of Object.keys
      // Yes, that violates the API contract of Object and is bad
      // Yes, this is how the npm client actually works
      var resultVersions;
      resultVersions = Object.keys(res.json.firstCall.args[1].test.versions);
      expect(resultVersions).to.deep.equal(versions.sort(semver.compare));
    });
  });
});