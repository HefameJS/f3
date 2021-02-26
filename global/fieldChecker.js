'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;


/**
 * Comprueba que un valor dado exista y no sea null.
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
 */
const checkExists = (campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) => {
	if (campo === null || campo === undefined) {
		if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
		return true;
	}
	return false;
}

/**
 * Comprueba que un valor dado exista y no sea null.
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
 */
const checkExistsAndNotEmptyString = (campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) => {
	if (campo === null || campo === undefined || typeof campo !== 'string' || campo.trim() === "") {
		if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
		return true;
	}
	return false;
}

/**
 * Comprueba que un valor dado sea un String o sea nulo.
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
 */
const checkString = (campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) => {
	return (typeof campo === 'string' || campo === null || campo === undefined) 
}

/**
* Comprueba que un valor dado exista, sea un número y mayor que cero.
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
*/
const checkExistsAndPositive = (campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) => {
	if (campo) {
		let asInt = Number(campo);
		if (!asInt || asInt <= 0 || asInt === Number.NaN || asInt === Number.NEGATIVE_INFINITY || asInt === Number.POSITIVE_INFINITY) {
			if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
			return true;
		}
	} else {
		if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
		return true;
	}
	return false;
}

/**
* Comprueba que un valor dado exista, sea un número y mayor o igual que cero
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
*/
const checkExistsAndPositiveOrZero = (campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) => {
	if (campo === 0) return false;
	return checkExistsAndPositive(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom);
}


/**
* Comprueba que un valor sea un número y mayor que cero. 
* Si el valor no existe no se considera error.
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
*/
const checkPositive = (campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) => {
	if (campo || campo === 0) {
		let asInt = Number(campo);
		if (!asInt || asInt <= 0 || asInt === Number.NaN || asInt === Number.NEGATIVE_INFINITY || asInt === Number.POSITIVE_INFINITY) {
			if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
			return true;
		}
	}
	return false;
}

/**
* Comprueba que un valor sea un número y mayor o igual que cero.
* Si el valor no existe no se considera error.
* @param {*} campo El valor a comprobar
* @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
* @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
* @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
*/
const checkPositiveOrZero = (campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) => {
	if (campo === 0) return false;
	return checkPositive(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom);
}

/**
* Comprueba que un valor exista y que sea un array no vacío.
* @param {*} campo El valor a comprobar
* @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
* @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
* @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
*/
const checkExistsAndNonEmptyArray = function checkExistsAndNonEmptyArray(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) {
	if (!campo || !campo.forEach || campo.length < 1) {
		if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
		return true;
	}
	return false;
}

/**
* Comprueba que un valor sea un array.
* Si el valor no existe no se considera error.
* @param {*} campo El valor a comprobar
* @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
* @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
* @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
*/
const checkArray = function checkExistsAndNonEmptyArray(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) {
	if (campo === null || campo === undefined || campo.forEach) {
		return false;
	}

	if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
	return true;
}

/**
 * Comprueba que un valor dado exista y sea un string en formato Fedicom3 Date.
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
 */
const checkExistsAndDate = (campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) => {

	let fechaFedicom = Date.fromFedicomDate(campo);

	if (!fechaFedicom /*|| Date.toFedicomDate(d) !== campo.trim().split(/\s/)[0].replace(/\-/g,'/')*/) {
		if (errorFedicom) errorFedicom.insertar(codigoErrorFedicom, descripcionErrorFedicom, 400);
		return true;
	}

	return false;
}

/**
 * Comprueba que si un valor está definido sea un string en formato Fedicom3 Date.
 * @param {*} campo El valor a comprobar
 * @param {ErrorFedicom} errorFedicom El objeto ErrorFedicom donde insertar el error en caso de existir
 * @param {string} codigoErrorFedicom El código de error que se introduce en caso de error
 * @param {string} descripcionErrorFedicom El mensaje de error que se introduce en caso de error
 */
const checkDate = (campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom) => {

	if (!campo) return true;
	return checkExistsAndDate(campo, errorFedicom, codigoErrorFedicom, descripcionErrorFedicom);
}


module.exports = {
	checkExists,
	checkExistsAndNotEmptyString,
	checkString,
	checkExistsAndPositive,
	checkExistsAndPositiveOrZero,
	checkPositive,
	checkPositiveOrZero,
	checkExistsAndNonEmptyArray,
	checkArray,
	checkExistsAndDate,
	checkDate
}
