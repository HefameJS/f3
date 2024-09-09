'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Externos
const dateFormat = require('dateformat');

/**
 * Date.fedicomTimestamp()
 * Devuelve el timestamp actual
 * 
 * - -> UNIX
 */
if (!Date.fedicomTimestamp) {
	Date.fedicomTimestamp = () => { 
		return new Date().getTime(); 
	}
}


dateFormat.masks.fedicomDate = 'dd/mm/yyyy';
dateFormat.masks.fedicomDateTime = 'dd/mm/yyyy HH:MM:ss';

dateFormat.masks.sapDate = 'yyyymmdd';
dateFormat.masks.sapTime = 'HHMMss';

dateFormat.masks.shortDate = 'yyyymmdd';
dateFormat.masks.shortTime = 'HHMMss.l';

/**
 * Date.toFedicomDate(date)
 * Devuelve una representación del objeto Date en formato Fedicom3 Date.
 * Si no se especifica la fecha de entrada, se asume el instante actual.
 * 
 * Date() -> 'dd/mm/yyyy'
 */
if (!Date.toFedicomDate) {
	Date.toFedicomDate = (date) => {
		if (!date || !(date instanceof Date) || isNaN(date)) date = new Date();
		return dateFormat(date, "fedicomDate")
	}
}

/**
 * Date.toFedicomDateTime(date)
 * Devuelve una representación del objeto Date en formato Fedicom3 DateTime.
 * Si no se especifica la fecha de entrada, se asume el instante actual.
 * 
 * Date() -> 'dd/mm/yyyy HH:MM:ss'
 */
if (!Date.toFedicomDateTime) {
	Date.toFedicomDateTime = (date) => {
		if (!date || !(date instanceof Date) || isNaN(date)) date = new Date();
		return dateFormat(date, "fedicomDateTime")
	}
}

/**
 * Date.fromFedicomDate
 * Construye un objeto Date a partir de un string en formato Fedicom3 Date.
 * 
 * 'dd/mm/yyyy' -> Date()
 */
if (!Date.fromFedicomDate) {
	Date.fromFedicomDate = (fedicomDate) => {
		return Date.fromFedicomDateTime(fedicomDate);
	}
}

/**
 * Date.fromFedicomDateTime
 * Construye un objeto Date a partir de un string en formato Fedicom3 DateTime.
 * 
 * 'dd/mm/yyyy HH:MM:ss' -> Date()
 */
if (!Date.fromFedicomDateTime) {
	Date.fromFedicomDateTime = (fedicomDateTime) => {
		if (!fedicomDateTime) return null;

		let str = fedicomDateTime.trim();
		let parts = str.split(/\s+/);


		let dateParts = parts[0].split(/[\/\-]/g);
		if (dateParts.length != 3) return null;
		
		if (parseInt(dateParts[2]) < 100) dateParts[2] = parseInt(dateParts[2]) + 2000; // Si el año es de 2 dígitos, le sumamos 2000. Ej. 21/11/19 -> 21/11/2019

		let timeParts = [0, 0, 0];
		if (parts[1]) {
			timeParts = parts[1].split(/\:/);
			while (timeParts.length < 3) timeParts.push(0);
		}

		try {
			let date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
			if (!date || !(date instanceof Date) || isNaN(date)) return null;
			return date;
		} catch (exception) {
			L.e('Date.fromFedicomDateTime: Error al convertir la fecha', fedicomDateTime, exception);
			return null;
		}

	}
}

/**
 * Date.fromSAPtoFedicomDate
 * Convierte un string en formato fecha SAP (yyyy-mm-dd) a formato Fedicom3
 * 
 * 'yyyy-mm-dd' -> 'dd/mm/yyyy'
 */
if (!Date.fromSAPtoFedicomDate) {
	Date.fromSAPtoFedicomDate = (sapDate) => {
		if (!sapDate) return null;

		let pedacicos = sapDate.split(/\-/g);
		if (pedacicos.length != 3) return null;

		return pedacicos[2] + '/' + pedacicos[1] + '/' + pedacicos[0];

	}
}



/**
 * Date.toSapDate(date)
 * Devuelve una representación del objeto Date en formato SAP (yyyymmdd).
 * Si no se especifica la fecha de entrada, se asume el instante actual.
 * 
 * Date() -> 'yyyymmdd'
 */
if (!Date.toSapDate) {
	Date.toSapDate = (date) => {
		if (!date || !(date instanceof Date) || isNaN(date)) date = new Date();
		return dateFormat(date, "sapDate")
	}
}

/**
 * Date.toSapTime(date)
 * Devuelve una representación del objeto Date en formato SAP (hhMMss).
 * Si no se especifica la fecha de entrada, se asume el instante actual.
 * 
 * Date() -> 'hhMMss'
 */
if (!Date.toSapTime) {
	Date.toSapTime = (date) => {
		if (!date || !(date instanceof Date) || isNaN(date)) date = new Date();
		return dateFormat(date, "sapTime")
	}
}

/**
 * Date.prototype.toShortDate
 * Devuelve una representación del objeto Date en formato corto (yyyymmdd).
 * 
 * Date() -> 'yyyymmdd'
 */
if (!Date.toShortDate) {
	Date.toShortDate = (date) => {
		if (!date || !(date instanceof Date) || isNaN(date)) date = new Date();
		return dateFormat(date, "shortDate")
	}
}


/**
 * Date.prototype.toShortTime
 * Devuelve una representación del objeto Date en formato corto (HHMMss.sss).
 * Date() -> 'HHMMss.sss'
 */
if (!Date.toShortTime) {
	Date.toShortTime = (date) => {
		if (!date || !(date instanceof Date) || isNaN(date)) date = new Date();
		return dateFormat(date, "shortTime")
	}
}

/**
 * ate.prototype.siguienteDiaHabil
 */
if (!Date.siguienteDiaHabil) {
	Date.siguienteDiaHabil = () => {
		let elDiaD = new Date();

		let diaSemana = elDiaD.getDay();
		if (diaSemana === 6) // Si es sábado, rebotamos al lunes (+2 días)
			elDiaD.setDate(elDiaD.getDate() + 2);
		else 
			elDiaD.setDate(elDiaD.getDate() + 1);

		return Date.toFedicomDate(elDiaD);
	}
}
