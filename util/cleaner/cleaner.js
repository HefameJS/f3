'use strict';
const BASE = global.BASE;
// const L = global.logger;
// const config = global.config;


const FedicomError = require(BASE + 'model/fedicomError');
const ERROR_CODE = 'PROTOCOL-999'

/**
 * Dado un objeto , hace comprobaciones de quen los campos sean correctos en funcion
 * del array de definiciones que se le pase.
 * 
 * En caso de encontrar errores, el campo se elimina y se añade una incidencia en el objeto.
 * NOTA: ¡ Se asume que el campo de incidencias viene vacío de entrada o se machacará !
 * 
 * @param {Object} json El objeto a tratar
 * @param {Array} definicionCampos array con la definicion de los campos válidos
 */
module.exports = function (json, definicionCampos) {

    var incidencias = new FedicomError();

    for (var campo in json) {

        var definicionDeCampo = definicionCampos[campo];
        var valorDeCampo = json[campo];

        if (!definicionDeCampo) {
            incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por no estar definido en el protocolo.');
            delete json[campo];
        } else {
            // IGNORE
            if (definicionDeCampo.ignore) {
                continue;
            }
            // CAMPOS DE SOLO SALIDA
            else if (definicionDeCampo.remove) {
                incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por ser un campo de solo salida.');
                delete json[campo];
            }
            // CAMPOS TIPO STRING
            else if (definicionDeCampo.string) {
                if (typeof valorDeCampo === 'string') {
                    if (valorDeCampo === '') {
                        incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por ser un string vacío.');
                        delete json[campo];
                    }
                    else if (definicionDeCampo.string.max && valorDeCampo.length > definicionDeCampo.string.max) {
                        incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ajusta al tamaño de ' + definicionDeCampo.string.max + ' caracteres.');
                        json[campo] = json[campo].substr(0, definicionDeCampo.string.max);
                    }
                    else if (definicionDeCampo.string.min && valorDeCampo.length < definicionDeCampo.string.min) {
                        incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por no cumplir con el mínimo de ' + definicionDeCampo.string.min + ' caracteres.');
                        delete json[campo];
                    }
                } else {
                    incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora porque se espaba un string.');
                    delete json[campo];
                }
            }
            // CAMPOS TIPO INTEGER
            else if (definicionDeCampo.integer) {
                if (valorDeCampo === '') {
                    incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se establece a 0 por venir vacío.');
                    delete json[campo];
                    continue;
                }
                var valorEnteroDeCampo = parseInt(valorDeCampo);
                if (valorEnteroDeCampo === Number.NaN) {
                    incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por no ser un entero válido.');
                    delete json[campo];
                }
                else if (definicionDeCampo.integer.max && valorEnteroDeCampo > definicionDeCampo.integer.max) {
                    incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por ser superior a ' + definicionDeCampo.integer.max + '.');
                    delete json[campo];
                }
                else if (definicionDeCampo.integer.min && valorEnteroDeCampo < definicionDeCampo.integer.min) {
                    incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por ser inferior a ' + definicionDeCampo.integer.min + '.');
                    delete json[campo];
                } else if (typeof valorDeCampo !== 'numeric') {
                    incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se convierte de ' + typeof valorDeCampo + ' a integer.');
                    json[campo] = valorEnteroDeCampo;
                }
            }
            // CAMPOS TIPO DATETIME
            else if (definicionDeCampo.datetime) {
                var date = Date.fromFedicomDateTime(valorDeCampo);
                if (!date) {
                    incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por no estar en formato Fedicom3-DateTime (yyyy/mm/dd HH:MM:SS).');
                    delete json[campo];
                } else {
                    var normalizedDate = Date.toFedicomDateTime(date);
                    if (normalizedDate !== valorDeCampo) {
                        incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ha modificado para convertirlo en una fecha/hora válida [' + valorDeCampo + ' -> ' + normalizedDate + '].');
                        json[campo] = normalizedDate;
                    }

                }
            }
            // CAMPOS TIPO DATE
            else if (definicionDeCampo.date) {
                var date = Date.fromFedicomDate(valorDeCampo);
                if (!date) {
                    incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por no estar en formato Fedicom3-Date (yyyy/mm/dd).');
                    delete json[campo];
                } else {
                    var normalizedDate = Date.toFedicomDate(date);
                    if (normalizedDate !== valorDeCampo) {
                        incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ha modificado para convertirlo en una fecha válida [' + valorDeCampo + ' -> ' + normalizedDate + '].');
                        json[campo] = normalizedDate;
                    }

                }
            }
            // CAMPOS TIPO BOOLEAN
            else if (definicionDeCampo.boolean) {
                if (typeof valorDeCampo !== 'boolean') {
                    if (valorDeCampo.toLowerCase() === 'true') {
                        incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se convierte de ' + typeof valorDeCampo + ' a boolean (true).');
                        json[campo] = true;
                    }
                    else {
                        incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por no ser un booleano válido.');
                        delete json[campo];
                    }
                }
            }
            // CAMPOS TIPO OBJECT
            else if (definicionDeCampo.object) {
                if (!valorDeCampo || typeof valorDeCampo !== 'object') {
                    incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por no ser un objeto válido.');
                    delete json[campo];
                }
            }
            // CAMPOS TIPO ARRAY
            else if (definicionDeCampo.array) {
                if (!valorDeCampo && !valorDeCampo.forEach) {
                    incidencias.add(ERROR_CODE, 'El campo \'' + campo + '\' se ignora por no ser un array.');
                    delete json[campo];
                }
            }
        }
    }

    return incidencias;
};