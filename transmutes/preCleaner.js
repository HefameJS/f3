'use strict';
const BASE = global.BASE;
const L = global.logger;
const C = global.config;
const K = global.constants;


const FedicomError = require(BASE + 'model/fedicomError');
const ERROR_CODE = K.CODIGOS_ERROR_FEDICOM.WARN_PROTOCOLO;
const DEPURACION_ACTIVA = (C.depurar_transmisiones ? true : false);
const iFlags = require(BASE + 'interfaces/iFlags');
const FLAG_ERROR_FORMATO = K.FLAGS.FORMATO;


const errorEncontrado = (txId, incidencias, mensaje) => {
    iFlags.set(txId, FLAG_ERROR_FORMATO);
    if (DEPURACION_ACTIVA) incidencias.add(ERROR_CODE, mensaje);
    L.xw(txId, mensaje, 'preCleaner');
}

/**
 * Dado un objeto, hace comprobaciones de quen los campos sean correctos en funcion
 * del array de definiciones que se le pase.
 * 
 * En caso de encontrar errores, se devuelve un objeto FedicomError con incidencias.
 * 
 * @param {Object} json El objeto a tratar
 * @param {Array} definicionCampos array con la definicion de los campos válidos
 */
const preClean = (txId, json, definicionCampos) => {

    var incidencias = new FedicomError();

    for (var campo in json) {

        var definicionDeCampo = definicionCampos[campo];
        var valorDeCampo = json[campo];

        if (!definicionDeCampo) {
            errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por no estar definido en el protocolo.');
            delete json[campo];
        } else {
            // IGNORE
            if (definicionDeCampo.ignore) {
                continue;
            }
            // CAMPOS DE SOLO SALIDA
            else if (definicionDeCampo.remove) {
                errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por ser un campo de solo salida.');
                delete json[campo];
            }
            // CAMPOS TIPO STRING
            else if (definicionDeCampo.string) {
                if (typeof valorDeCampo === 'string') {
                    if (valorDeCampo === '') {
                        errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por ser un string vacío.');
                        delete json[campo];
                    }
                    else if (definicionDeCampo.string.max && valorDeCampo.length > definicionDeCampo.string.max) {
                        errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ajusta al tamaño de ' + definicionDeCampo.string.max + ' caracteres.');
                        json[campo] = json[campo].substr(0, definicionDeCampo.string.max);
                    }
                    else if (definicionDeCampo.string.min && valorDeCampo.length < definicionDeCampo.string.min) {
                        errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por no cumplir con el mínimo de ' + definicionDeCampo.string.min + ' caracteres.');
                        delete json[campo];
                    }
                } else {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora porque se esperaba un string.');
                    delete json[campo];
                }
            }
            // CAMPOS TIPO INTEGER
            else if (definicionDeCampo.integer) {
                if (valorDeCampo === '') {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se elimina por venir vacío.');
                    delete json[campo];
                    continue;
                }
                var valorDecimalDeCampo = parseInt(valorDeCampo);
                if (valorDecimalDeCampo === Number.NaN) {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por no ser un entero válido.');
                    delete json[campo];
                }
                else if (definicionDeCampo.integer.max && valorDecimalDeCampo > definicionDeCampo.integer.max) {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por ser superior a ' + definicionDeCampo.integer.max + '.');
                    delete json[campo];
                }
                else if (definicionDeCampo.integer.min && valorDecimalDeCampo < definicionDeCampo.integer.min) {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por ser inferior a ' + definicionDeCampo.integer.min + '.');
                    delete json[campo];
                } else if (typeof valorDeCampo !== 'number') {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se convierte de ' + typeof valorDeCampo + ' a integer.');
                    json[campo] = valorDecimalDeCampo;
                }
            }
            // CAMPOS TIPO DECIMAL
            else if (definicionDeCampo.decimal) {
                if (valorDeCampo === '') {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se elimina por venir vacío.');
                    delete json[campo];
                    continue;
                }
                var valorDecimalDeCampo = parseFloat(valorDeCampo);
                if (valorDecimalDeCampo === Number.NaN) {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por no ser un número decimal válido.');
                    delete json[campo];
                }
                else if (definicionDeCampo.decimal.max && valorDecimalDeCampo > definicionDeCampo.decimal.max) {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por ser superior a ' + definicionDeCampo.decimal.max + '.');
                    delete json[campo];
                }
                else if (definicionDeCampo.decimal.min && valorDecimalDeCampo < definicionDeCampo.decimal.min) {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por ser inferior a ' + definicionDeCampo.decimal.min + '.');
                    delete json[campo];
                } else if (typeof valorDeCampo !== 'number') {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se convierte de ' + typeof valorDeCampo + ' a decimal.');
                    json[campo] = valorDecimalDeCampo;
                }
            }
            // CAMPOS TIPO DATETIME
            else if (definicionDeCampo.datetime) {
                if (valorDeCampo === '' || valorDeCampo === null) {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por estar vacío.');
                    delete json[campo];
                } else {
                    var date = Date.fromFedicomDateTime(valorDeCampo);
                    if (!date) {
                        errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por no estar en formato Fedicom3-DateTime (dd/mm/yyyy HH:MM:SS).');
                        delete json[campo];
                    } else {
                        var normalizedDate = Date.toFedicomDateTime(date);
                        if (normalizedDate !== valorDeCampo.trim().replace(/\-/g, '/')) {
                            errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ha modificado para convertirlo en una fecha/hora válida [' + valorDeCampo + ' -> ' + normalizedDate + '].');
                            json[campo] = normalizedDate;
                        }

                    }
                }
            }
            // CAMPOS TIPO DATE
            else if (definicionDeCampo.date) {
                if (valorDeCampo === '' || valorDeCampo === null) {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por estar vacío.');
                    delete json[campo];
                } else {
                    var date = Date.fromFedicomDate(valorDeCampo);
                    if (!date) {
                        errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por no estar en formato Fedicom3-Date (dd/mm/yyyy).');
                        delete json[campo];
                    } else {
                        var normalizedDate = Date.toFedicomDate(date);
                        if (normalizedDate !== valorDeCampo.trim().replace(/\-/g, '/')) {
                            errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ha modificado para convertirlo en una fecha válida [' + valorDeCampo + ' -> ' + normalizedDate + '].');
                            json[campo] = normalizedDate;
                        }

                    }
                }
            }
            // CAMPOS TIPO BOOLEAN
            else if (definicionDeCampo.boolean) {
                if (typeof valorDeCampo !== 'boolean') {
                    if (valorDeCampo && valorDeCampo.toLowerCase && valorDeCampo.toLowerCase() === 'true') {
                        errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se convierte de ' + typeof valorDeCampo + ' a boolean (true).');
                        json[campo] = true;
                    }
                    else {
                        errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por no ser un booleano válido.');
                        delete json[campo];
                    }
                }
            }
            // CAMPOS TIPO OBJECT
            else if (definicionDeCampo.object) {
                if (!valorDeCampo || typeof valorDeCampo !== 'object') {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por no ser un objeto válido.');
                    delete json[campo];
                }
            }
            // CAMPOS TIPO ARRAY
            else if (definicionDeCampo.array) {
                if (!valorDeCampo || !valorDeCampo.forEach) {
                    errorEncontrado(txId, incidencias, 'El campo \'' + campo + '\' se ignora por no ser un array.');
                    delete json[campo];
                }
            }
        }
    }

    return incidencias;
}


module.exports = {
    clean: preClean
};