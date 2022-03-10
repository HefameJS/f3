'use strict';


class FakeRes {

	headers = {};
	statusCode = 0;
	headersSent = false;
	body = null;

	constructor() {

	}

	setHeader(key, value) {
		this.headers[key] = value;
	}

	getHeaders() {
		return this.headers;
	}

	status(code) {
		this.statusCode = code;
		return this;
	}

	send(body) {
		this.body = body;
		this.headersSent = true;
		return this;
	}
}

module.exports = FakeRes;