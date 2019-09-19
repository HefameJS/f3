'use strict';
const BASE = global.BASE;

var dateFormat = require('dateformat');

/**
 * Date.fedicomTimestamp()
 * Devuelve el timestamp actual
 */
if (!Date.fedicomTimestamp) {
	Date.fedicomTimestamp = function() { return new Date().getTime(); }
}


dateFormat.masks.fedicomDate = 'dd/mm/yyyy';
dateFormat.masks.fedicomDateTime = 'dd/mm/yyyy HH:MM:ss';

/**
 * fedicomDate
 * Devuelve una representación del objeto Date en formato Fedicom3 Date.
 * Si no se especifica la fecha de entrada, se asume el instante actual.
 */
if (!Date.toFedicomDate) {
	Date.toFedicomDate = function (date) {
		if (!date) date = new Date();
		return dateFormat(date, "fedicomDate")
	}
}

/**
 * fedicomDateTime
 * Devuelve una representación del objeto Date en formato Fedicom3 DateTime.
 * Si no se especifica la fecha de entrada, se asume el instante actual.
 */
if (!Date.toFedicomDateTime) {
	Date.toFedicomDateTime = function (date) {
		if (!date) date = new Date();
		return dateFormat(date, "fedicomDateTime")
	}
}


