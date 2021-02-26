'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;


/**
 * Comprueba que un valor dado exista -> Es decir, no sea null ni undefined.
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
 */
function existe(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) {
	if (campo === null || campo === undefined) {
		if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
		return false;
	}
	return true;
}


/**
 * Comprueba que un valor dado sea un string no vacío
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
 */
function esCadenaNoVacia(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) {
	if (campo === null || campo === undefined || typeof campo !== 'string' || campo.trim() === "") {
		if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
		return false;
	}
	return true;
}




/*******************************************************************************************************************************
 * ENTEROS
 */



/**
* Comprueba que un valor dado exista, sea un número y mayor que cero.
* @param {*} campo El valor a comprobar
* @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
* @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
* @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
*/
function esEnteroPositivoMayorQueCero(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) {
	if (campo) {
		let asInt = Number(campo);
		if (!asInt || asInt <= 0 || asInt === Number.NaN || asInt === Number.NEGATIVE_INFINITY || asInt === Number.POSITIVE_INFINITY) {
			if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
			return false;
		}
		return true;
	} 
	
	if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
	return false;
	
}

/**
* Comprueba que un valor dado exista, sea un número y mayor que cero.
* @param {*} campo El valor a comprobar
* @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
* @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
* @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
*/
function esEnteroPositivo(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) {
	if (campo === 0) return true;
	return esEnteroPositivoMayorQueCero(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom);
}


/*******************************************************************************************************************************
 * FECHAS
 */



/**
 * Comprueba que un valor dado exista y sea un string en formato Fedicom3 Date.
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
 */
function esFecha(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) {

	let fechaFedicom = Date.fromFedicomDate(campo);
	
	if (!fechaFedicom) {
		if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
		return false;
	}

	return true;
}

/**
 * Comprueba que un valor dado exista y sea un string en formato Fedicom3 Date.
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
 */
function esFechaHora(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) {

	if (!campo) {
		if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
		return false;		
	}

	let fechaFedicom = Date.fromFedicomDateTime(campo);

	if (!fechaFedicom) {
		if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
		return false;
	}

	return true;
}


/*******************************************************************************************************************************
 * ARRAYS
 */

/**
* Comprueba que un valor exista y que sea un array no vacío.
* @param {*} campo El valor a comprobar
* @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
* @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
* @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
*/
function esArrayNoVacio(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) {
	if (!campo || !campo.forEach || campo.length < 1) {
		if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
		return false;
	}
	return true;
}


module.exports = {
	existe,
	esCadenaNoVacia,
	esEnteroPositivo,
	esEnteroPositivoMayorQueCero,
	esFecha,
	esFechaHora,
	esArrayNoVacio
}