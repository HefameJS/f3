'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iFlags = require('interfaces/iFlags');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');

const CODIGO_ERROR_PROTOCOLO = K.CODIGOS_ERROR_FEDICOM.WARN_PROTOCOLO;
const DEPURACION_ACTIVA = (C.depurar_transmisiones ? true : false);
const FLAG_ERROR_FORMATO = C.flags.FORMATO;


const _errorEncontrado = (txId, errorFedicom, mensaje) => {
    iFlags.set(txId, FLAG_ERROR_FORMATO);
    if (DEPURACION_ACTIVA) errorFedicom.insertar(CODIGO_ERROR_PROTOCOLO, mensaje);
    L.xw(txId, mensaje, 'preCleaner');
}

/**
 * Dado un objeto, hace comprobaciones de quen los campos sean correctos en funcion
 * del array de definiciones que se le pase.
 * 
 * En caso de encontrar errores, se devuelve un objeto ErrorFedicom con incidencias.
 * 
 * @param {Object} json El objeto a tratar
 * @param {Array} definicionCampos array con la definicion de los campos válidos
 */
const preClean = (txId, json, definicionCampos) => {

    let errorFedicom = new ErrorFedicom();

    for (let campo in json) {

        let definicionDeCampo = definicionCampos[campo];
        let valorDeCampo = json[campo];

        if (!definicionDeCampo) {
            _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por no estar definido en el protocolo.');
            delete json[campo];
        } else {
            // IGNORE
            if (definicionDeCampo.ignore) {
                continue;
            }
            // CAMPOS DE SOLO SALIDA
            else if (definicionDeCampo.remove) {
                _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por ser un campo de solo salida.');
                delete json[campo];
            }
            // CAMPOS TIPO STRING
            else if (definicionDeCampo.string) {
                if (typeof valorDeCampo === 'string') {
                    if (valorDeCampo === '') {
                        _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por ser un string vacío.');
                        delete json[campo];
                    }
                    else if (definicionDeCampo.string.max && valorDeCampo.length > definicionDeCampo.string.max) {
                        _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ajusta al tamaño de ' + definicionDeCampo.string.max + ' caracteres.');
                        json[campo] = json[campo].substr(0, definicionDeCampo.string.max);
                    }
                    else if (definicionDeCampo.string.min && valorDeCampo.length < definicionDeCampo.string.min) {
                        _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por no cumplir con el mínimo de ' + definicionDeCampo.string.min + ' caracteres.');
                        delete json[campo];
                    }
                } else {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora porque se esperaba un string.');
                    delete json[campo];
                }
            }
            // CAMPOS TIPO INTEGER
            else if (definicionDeCampo.integer) {
                if (valorDeCampo === '') {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se elimina por venir vacío.');
                    delete json[campo];
                    continue;
                }
                let valorDecimalDeCampo = parseInt(valorDeCampo);
                if (valorDecimalDeCampo === Number.NaN) {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por no ser un entero válido.');
                    delete json[campo];
                }
                else if (definicionDeCampo.integer.max && valorDecimalDeCampo > definicionDeCampo.integer.max) {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por ser superior a ' + definicionDeCampo.integer.max + '.');
                    delete json[campo];
                }
                else if (definicionDeCampo.integer.min && valorDecimalDeCampo < definicionDeCampo.integer.min) {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por ser inferior a ' + definicionDeCampo.integer.min + '.');
                    delete json[campo];
                } else if (typeof valorDeCampo !== 'number') {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se convierte de ' + typeof valorDeCampo + ' a integer.');
                    json[campo] = valorDecimalDeCampo;
                }
            }
            // CAMPOS TIPO DECIMAL
            else if (definicionDeCampo.decimal) {
                if (valorDeCampo === '') {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se elimina por venir vacío.');
                    delete json[campo];
                    continue;
                }
                let valorDecimalDeCampo = parseFloat(valorDeCampo);
                if (valorDecimalDeCampo === Number.NaN) {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por no ser un número decimal válido.');
                    delete json[campo];
                }
                else if (definicionDeCampo.decimal.max && valorDecimalDeCampo > definicionDeCampo.decimal.max) {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por ser superior a ' + definicionDeCampo.decimal.max + '.');
                    delete json[campo];
                }
                else if (definicionDeCampo.decimal.min && valorDecimalDeCampo < definicionDeCampo.decimal.min) {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por ser inferior a ' + definicionDeCampo.decimal.min + '.');
                    delete json[campo];
                } else if (typeof valorDeCampo !== 'number') {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se convierte de ' + typeof valorDeCampo + ' a decimal.');
                    json[campo] = valorDecimalDeCampo;
                }
            }
            // CAMPOS TIPO DATETIME
            else if (definicionDeCampo.datetime) {
                if (valorDeCampo === '' || valorDeCampo === null) {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por estar vacío.');
                    delete json[campo];
                } else {
                    let date = Date.fromFedicomDateTime(valorDeCampo);
                    if (!date) {
                        _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por no estar en formato Fedicom3-DateTime (dd/mm/yyyy HH:MM:SS).');
                        delete json[campo];
                    } else {
                        let normalizedDate = Date.toFedicomDateTime(date);
                        if (normalizedDate !== valorDeCampo.trim().replace(/\-/g, '/')) {
                            _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ha modificado para convertirlo en una fecha/hora válida [' + valorDeCampo + ' -> ' + normalizedDate + '].');
                            json[campo] = normalizedDate;
                        }

                    }
                }
            }
            // CAMPOS TIPO DATE
            else if (definicionDeCampo.date) {
                if (valorDeCampo === '' || valorDeCampo === null) {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por estar vacío.');
                    delete json[campo];
                } else {
                    let date = Date.fromFedicomDate(valorDeCampo);
                    if (!date) {
                        _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por no estar en formato Fedicom3-Date (dd/mm/yyyy).');
                        delete json[campo];
                    } else {
                        let normalizedDate = Date.toFedicomDate(date);
                        if (normalizedDate !== valorDeCampo.trim().replace(/\-/g, '/')) {
                            _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ha modificado para convertirlo en una fecha válida [' + valorDeCampo + ' -> ' + normalizedDate + '].');
                            json[campo] = normalizedDate;
                        }

                    }
                }
            }
            // CAMPOS TIPO BOOLEAN
            else if (definicionDeCampo.boolean) {
                if (typeof valorDeCampo !== 'boolean') {
                    if (valorDeCampo && valorDeCampo.toLowerCase && valorDeCampo.toLowerCase() === 'true') {
                        _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se convierte de ' + typeof valorDeCampo + ' a boolean (true).');
                        json[campo] = true;
                    }
                    else {
                        _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por no ser un booleano válido.');
                        delete json[campo];
                    }
                }
            }
            // CAMPOS TIPO OBJECT
            else if (definicionDeCampo.object) {
                if (!valorDeCampo || typeof valorDeCampo !== 'object') {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por no ser un objeto válido.');
                    delete json[campo];
                }
            }
            // CAMPOS TIPO ARRAY
            else if (definicionDeCampo.array) {
                if (!valorDeCampo || !valorDeCampo.forEach) {
                    _errorEncontrado(txId, errorFedicom, 'El campo \'' + campo + '\' se ignora por no ser un array.');
                    delete json[campo];
                }
            }
        }
    }

    return errorFedicom;
}


module.exports = {
    clean: preClean
};