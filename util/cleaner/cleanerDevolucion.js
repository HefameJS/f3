'use strict';
const BASE = global.BASE;
// const L = global.logger;
// const config = global.config;

const clean = require(BASE + 'util/cleaner/cleaner');


const DEFINICION_CAMPOS_CABECERA = {
    // Campos que al ser obligatorios se verifican en la creacion del objeto y por tanto ignoramos
    codigoCliente: { ignore: true },
    lineas: { ignore: true },
    login: { ignore: true },
    crc: { ignore: true },

    // Campos que son de solo salida, es decir, no deberían aparecer en las peticiones
    numeroDevolucion: { remove: true },
    fechaDevolucion: { remove: true },
    codigoRecogida: { remove: true },
    numeroAlbaranAbono: { remove: true },
    fechaAlbaranAbono: { remove: true },
    empresaFacturadora: { remove: true },
    
    // Campos que de aparecer deben ser cadenas de texto
    observaciones: { string: { max: 50} },

    // Campos que deben ser array
    incidencias: { array: {} }
};

const DEFINICION_CAMPOS_LINEAS = {
    // Campos que al ser obligatorios se verifican en la creacion del objeto y por tanto ignoramos
    codigoArticulo: { ignore: true },
    sap_ignore: { ignore: true },
    

    // Campos que son de solo salida, es decir, no deberían aparecer en las peticiones
    descripcionArticulo: { remove: true },
    descripcionMotivo: { remove: true },

    // Campos que de aparecer deben ser cadenas de texto
    numeroAlbaran: { string: { max: 50 } },
    codigoArticulo: { string: { max: 15 } },
    lote: { string: { max: 15 } },
    codigoMotivo: { string: { max: 15 } },
    valeEstupefaciente: { string: { max: 50 } },
    observaciones: { string: { max: 50 } },
    
    
    // Campos que de aparecer deben ser enteros
    orden: { integer: { } },
    cantidad: { integer: { } },

    // Campos que de aparecer deben estar en formato Date
    fechaAlbaran: { date: {} },
    fechaCaducidad: { date: {} },

    // Campos que deben ser array
    incidencias: { array: {} }

};




/**
 * Dado un objeto pedido creado a partir de una transmisión, hace comprobaciones
 * de que los campos sean correctos.
 *
 * En caso de encontrar errores, el campo se elimina y se añade una incidencia en el mismo pedido.
 * NOTA: ¡ Se asume que el campo de incidencias viene vacío de entrada tanto a nivel 
 *          de cabecera como de líneas !
 *
 * @param {Devolucion} json El objeto pedido a tratar
 */
module.exports = function(pedido) {

    var incidenciasCabecera = clean(pedido, DEFINICION_CAMPOS_CABECERA);
    pedido.lineas.forEach( (lineaPedido) => {
        var incidenciasLinea = clean(lineaPedido, DEFINICION_CAMPOS_LINEAS);
        if (incidenciasLinea.hasError()) {
            if (lineaPedido.incidencias && lineaPedido.incidencias.push) {
                lineaPedido.incidencias.concat(incidenciasLinea.getErrors());
            } else {
                lineaPedido.incidencias = incidenciasLinea.getErrors();
            }
        }
    });

    if (pedido.incidencias && pedido.incidencias.push) {
        pedido.incidencias.concat(incidenciasCabecera.getErrors());
    } else {
        pedido.incidencias = incidenciasCabecera.getErrors();
    }

};
    

