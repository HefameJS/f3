'use strict';


class FakeRes {

	headers = [];
	statusCode = 0;
	headersSent = false;

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

	send() {
		//noop
		this.headersSent = true;
		return this;
	}
}

module.exports = FakeRes;