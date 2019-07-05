'use strict';
const BASE = global.BASE;

var dateFormat = require('dateformat');

// Date.timestamp() devuelve el timestamp actual
if (!Date.timestamp) {
    Date.timestamp = function() { return new Date().getTime(); }
}


dateFormat.masks.fedicomDate = 'dd-mm-yyyy';
dateFormat.masks.fedicomDateTime = 'dd-mm-yyyy HH:MM:ss';

//
if (!Date.fedicomDate) {
	Date.fedicomDate = function (date) {
		if (!date) date = new Date();
		return dateFormat(date, "fedicomDate")
	}
}


if (!Date.fedicomDateTime) {
	Date.fedicomDateTime = function (date) {
		if (!date) date = new Date();
		return dateFormat(date, "fedicomDateTime")
	}
}
