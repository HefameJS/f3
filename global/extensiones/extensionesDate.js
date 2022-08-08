'use strict';

// Externos
const { format, isSaturday, isFriday } = require("date-fns");


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

const FORMATOS = {
	fedicomDate: 'dd/MM/yyyy',
	fedicomDateTime: 'dd/MM/yyyy HH:mm:ss',
	sapDate: 'yyyyMMdd',

	shortDate: 'yyyyMMdd',
	shortTime: 'HHMMss.S',

	logCorto: 'yyyyMMdd',
	logLargo: 'dd-MM-yyyy-HH:mm:ss.SSS',

	crc: 'yyyyMMdd'
}



if (!Date.prototype.aCrc) {
	// Date.prototype.formatear = {}
	// let funciones = Date.prototype.formatear;

	Date.prototype.aCrc = function () {
		return format(this, FORMATOS.crc)
	}
}

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
		return format(date, FORMATOS.fedicomDate)
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
		return format(date, FORMATOS.fedicomDateTime)
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
		return format(date, FORMATOS.sapDate)
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
		return format(date, FORMATOS.shortDate)
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
		return format(date, FORMATOS.shortTime)
	}
}

/**
 * Date.prototype.siguienteDiaHabil
 */
if (!Date.siguienteDiaHabil) {
	Date.siguienteDiaHabil = () => {

		let elDiaD = new Date();
		let retrasoEnDias = 1;
		if (isFriday(elDiaD)) retrasoEnDias = 3
		else if (isSaturday(elDiaD)) retrasoEnDias = 2
			
		addDays(elDiaD, retrasoEnDias);
		
		return Date.toFedicomDate(elDiaD);
	}
}




/**
 * Date.logCorto()
 * 
 * -> 'yyyymmdd'
 */
if (!Date.logCorto) {
	Date.logCorto = () => {
		return format(new Date(), FORMATOS.logCorto)
	}
}

/**
 * Date.logCorto()
 * 
 * -> 'yyyy-mm-dd HH:MM:ss'
 */
if (!Date.logLargo) {
	Date.logLargo = () => {
		return format(new Date(), FORMATOS.logLargo)
	}
}