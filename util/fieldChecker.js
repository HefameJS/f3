'use strict';
const BASE = global.BASE;
const L = global.logger;

module.exports =  {
	checkExists: function(field, errorObject, errorCode, errorDesc ) {
		if (field === null || field === undefined) {
			if (errorObject) errorObject.add(errorCode, errorDesc, 400);
			return true;
		}
		return false;
	},

	checkExistsAndPositive: function (field, errorObject, errorCode, errorDesc ) {
		if (field) {
			var asInt = Number(field);
			if (!asInt || asInt <= 0 || asInt === Number.NaN || asInt === Number.NEGATIVE_INFINITY || asInt === Number.POSITIVE_INFINITY ) {
				if (errorObject) errorObject.add(errorCode, errorDesc, 400);
				return true;
			}
		} else {
			if (errorObject) errorObject.add(errorCode, errorDesc, 400);
			return true;
		}
		return false;
	},

	checkExistsAndPositiveOrZero: function (field, errorObject, errorCode, errorDesc ) {
		if (field === 0) return false;
		return this.checkExistsAndPositive(field, errorObject, errorCode, errorDesc);
	},


	checkPositive: function (field, errorObject, errorCode, errorDesc ) {
		if (field || field === 0) {
			var asInt = Number(field);
			if (!asInt || asInt <= 0 || asInt === Number.NaN || asInt === Number.NEGATIVE_INFINITY || asInt === Number.POSITIVE_INFINITY ) {
				if (errorObject) errorObject.add(errorCode, errorDesc, 400);
				return true;
			}
		}
		return false;
	},

	checkPositiveOrZero: function (field, errorObject, errorCode, errorDesc ) {
		if (field === 0) return false;
		return this.checkPositive(field, errorObject, errorCode, errorDesc);
	},

	checkExistsAndNonEmptyArray: function checkExistsAndNonEmptyArray(field, errorObject, errorCode, errorDesc ) {
		if (!field || !field.forEach || field.length < 1) {
			if (errorObject) errorObject.add(errorCode, errorDesc, 400);
			return true;
		}
		return false;
	}

}
