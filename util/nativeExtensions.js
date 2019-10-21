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
 * Date.toFedicomDate(date)
 * Devuelve una representación del objeto Date en formato Fedicom3 Date.
 * Si no se especifica la fecha de entrada, se asume el instante actual.
 */
if (!Date.toFedicomDate) {
	Date.toFedicomDate = function (date) {
		if (!date || !date instanceof Date || isNaN(date)) date = new Date();
		return dateFormat(date, "fedicomDate")
	}
}

/**
 * Date.toFedicomDateTime(date)
 * Devuelve una representación del objeto Date en formato Fedicom3 DateTime.
 * Si no se especifica la fecha de entrada, se asume el instante actual.
 */
if (!Date.toFedicomDateTime) {
	Date.toFedicomDateTime = function (date) {
		if (!date || !date instanceof Date || isNaN(date)) date = new Date();
		return dateFormat(date, "fedicomDateTime")
	}
}


/**
 * Date.fromFedicomDate
 * Construye un objeto Date a partir de un string en formato Fedicom3 Date.
 */
if (!Date.fromFedicomDate) {
	Date.fromFedicomDate = function (string) {
		return Date.fromFedicomDateTime(string);
	}
}

/**
 * Date.fromFedicomDateTime
 * Construye un objeto Date a partir de un string en formato Fedicom3 DateTime.
 */
if (!Date.fromFedicomDateTime) {
	Date.fromFedicomDateTime = function (string) {
		if (!string) return null;

		var str = string.trim();
		var parts = str.split(/\s+/);


		var dateParts = parts[0].split(/[\/\-]/g);
		if (dateParts.length != 3) return null;
		
		if (parseInt(dateParts[2]) < 100) dateParts[2] = parseInt(dateParts[2]) + 2000; // Si el año es de 2 dígitos, le sumamos 2000. Ej. 21/11/19 -> 21/11/2019

		if (parts[1]) {
			var timeParts = parts[1].split(/\:/);
			while (timeParts.length < 3) timeParts.push(0);
		} else {
			var timeParts = [0,0,0];
		}

		try {
			var date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
			if (!date || !date instanceof Date || isNaN(date)) return null;
			return date;
		} catch (exception) {
			console.log('Error al convertir la fecha', date, exception);
			return null;
		}

	}
}

