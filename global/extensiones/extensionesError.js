'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

if (!('toJSON' in Error.prototype)) {
	Object.defineProperty(Error.prototype, 'toJSON', {
		value: function () {
			var alt = {};

			Object.getOwnPropertyNames(this).forEach(function (key) {
				alt[key] = this[key];
			}, this);

			return alt;
		},
		configurable: true,
		writable: true
	});
}