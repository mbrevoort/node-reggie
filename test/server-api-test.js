var request = require('supertest');
var helpers = require('./helpers.js');

describe('GET /:name/-/:file', function(done) {
	before(helpers.prepareSandbox);
	before(helpers.startReggieServer);
	after(helpers.stopReggieServer);

	it('should respond with 404 when file does not exist', function(done) {
		request(helpers.reggieUrl)
		.get('/requirejs/-/requirejs-2.11.tgz')
		.expect(404, done);
	});
});
