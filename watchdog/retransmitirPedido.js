'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo/iMongo');
const iSap = require(BASE + 'interfaces/isap/iSap');
const iEventos = require(BASE + 'interfaces/eventos/iEventos');

// Modelos
const ObjectID = iMongo.ObjectID;
const ErrorFedicom = require(BASE + 'model/ModeloErrorFedicom');
const Pedido = require(BASE + 'model/pedido/ModeloPedido');

// Helpers
const extensionesExpress = require(BASE + 'util/extensionesExpress');


const estadosRetransmitibles = [
    K.TX_STATUS.RECEPCIONADO,
    K.TX_STATUS.ESPERANDO_INCIDENCIAS,
    K.TX_STATUS.INCIDENCIAS_RECIBIDAS,
    K.TX_STATUS.NO_SAP
];

const estadosRetransmitiblesForzando = [
    K.TX_STATUS.OK,
    K.TX_STATUS.PETICION_INCORRECTA,
    K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO,
    K.TX_STATUS.RECHAZADO_SAP,
    K.TX_STATUS.PEDIDO.ESPERA_AGOTADA,
    K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP
];

/**
 * Retransmite un pedido.
 * 
 * @param {string} txId El ID de transmisión del pedido a retransmitir
 * @param {object} opcionesRetransmision Opciones de la retransmisión
 */
const retransmitirPedido = (txIdOriginal, opcionesRetransmision, callback) => {
    if (!opcionesRetransmision) opcionesRetransmision = {};

    opcionesRetransmision.force = opcionesRetransmision.force ? opcionesRetransmision.force : false;
    opcionesRetransmision.regenerateCRC = opcionesRetransmision.regenerateCRC ? opcionesRetransmision.regenerateCRC : false;
    opcionesRetransmision.forzarAlmacen = opcionesRetransmision.forzarAlmacen ? opcionesRetransmision.forzarAlmacen : undefined;
    opcionesRetransmision.sistemaSAP = opcionesRetransmision.sistemaSAP ? opcionesRetransmision.sistemaSAP : undefined;
    opcionesRetransmision.noActualizarOriginal = opcionesRetransmision.noActualizarOriginal ? opcionesRetransmision.noActualizarOriginal : false;

    let txIdRetransmision = new ObjectID();

    L.xi(txIdRetransmision, ['Retransmisión de pedido con ID ' + txIdOriginal, opcionesRetransmision]);

    iMongo.consultaTx.porId(txIdRetransmision, txIdOriginal, (errorMongo, dbTx) => {
        // Comprobación de error en la búsqueda
        if (errorMongo) {
            L.xe(txIdRetransmision, ['Ocurrió un error al buscar la transmisión en la base de datos', errorMongo]);
            return callback('Ocurrió un error al buscar la transmisión en la base de datos', txIdRetransmision);
        }

        // No se encuentra la transmisión a retransmitir
        if (!dbTx) {
            L.xe(txIdRetransmision, ['No se encontró la transmisión en la base de datos']);
            return callback('No se encontró la transmisión en la base de datos', txIdRetransmision);
        }

        // Escribimos en el log de la transmisión original, ahora que sabemos que existe:
        L.xi(txIdOriginal, ['Se lanza la retransmisión con ID ' + txIdRetransmision + ' para esta transmisión']);

        // La transmisión a retransmitir no es un pedido
        if (dbTx.type !== K.TX_TYPES.PEDIDO) {
            let mensajeDeError = 'La transmisión indicada no es un pedido';
            L.xe(txIdRetransmision, [mensajeDeError, dbTx.type]);
            L.xw(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con errores', mensajeDeError]);
            iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.IMPOSIBLE, mensajeDeError)
            return callback(mensajeDeError, txIdRetransmision);
        }
        L.xt(txIdRetransmision, ['OK: La transmisión es de tipo CREAR PEDIDO']);

        // Comprobamos que tenemos toda la información de la petición original necesaria. 
        if (!dbTx.clientRequest || !dbTx.clientRequest.body || !dbTx.clientRequest.authentication) {
            let mensajeDeError = 'La transmisión no tiene guardada toda la transmisión HTTP original necesaria';
            L.xf(txIdRetransmision, [mensajeDeError, dbTx]);
            L.xe(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con errores', mensajeDeError]);
            iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.IMPOSIBLE, mensajeDeError)
            return callback(mensajeDeError, txIdRetransmision);
        }
        L.xt(txIdRetransmision, ['OK: Tenemos todos los campos necesarios para la retransmisión']);

        let [esRetransmisible, estadoError, mensajeDeError] = _esRetransmisible(dbTx, opcionesRetransmision.force);
        if (!esRetransmisible) {
            L.xe(txIdRetransmision, [mensajeDeError, estadoError, dbTx.status]);
            L.xe(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con errores', errorMessage]);
            iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, estadoError, mensajeDeError)
            return callback(mensajeDeError, txIdRetransmision);
        }
        L.xt(txIdRetransmision, ['OK: La transmisión es válida para ser retransmitida']);

        // Recreamos el pedido, tal y como vendría en la petición original
        // Es decir, hacemos pasar 'dbTx.clientRequest' por la variable 'req' original.
        // Para esto, necesitaremos que existan los campos 'body', 'txId' y 'token'
        let pedido = null;
        try {
            dbTx.clientRequest.txId = dbTx._id;
            dbTx.clientRequest.token = dbTx.clientRequest.authentication;
            pedido = new Pedido(dbTx.clientRequest);
        } catch (excepcion) {
            let fedicomError = ErrorFedicom.desdeExcepcion(txIdRetransmision, excepcion);
            L.xe(txIdRetransmision, ['Ocurrió un error al analizar la petición', fedicomError])
            iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.OK, null, {
                clientResponse: fedicomError.getErrors(),
                status: K.TX_STATUS.PETICION_INCORRECTA
            });
            L.xi(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza en estado de PETICION INCORRECTA']);
            return callback(null, txIdRetransmision);
        }
        L.xt(txIdRetransmision, ['OK: El contenido de la transmisión es un pedido correcto', pedido]);


        if (opcionesRetransmision.sistemaSAP) {
            L.xd(txIdRetransmision, ['Se cambia el sistema SAP al que enviamos el pedido [' + (pedido.sapSystem || '<n/a>') + '] => [' + opcionesRetransmision.sistemaSAP + ']']);
            pedido.sapSystem = opcionesRetransmision.sistemaSAP;

            // Si cambia el sistema SAP, forzamos la regeneración del CRC y por tanto la creación de una transmisión nueva
            opcionesRetransmision.regenerateCRC = true;
        }

        if (opcionesRetransmision.forzarAlmacen) {
            L.xd(txIdRetransmision, ['Se fuerza el cambio del almacén del pedido [' + (pedido.codigoAlmacenServicio || '<n/a>') + '] => [' + opcionesRetransmision.forzarAlmacen + ']']);
            pedido.codigoAlmacenServicio = opcionesRetransmision.forzarAlmacen;

            // Si cambia el sistema SAP, forzamos la regeneración del CRC y por tanto la creación de una transmisión nueva
            opcionesRetransmision.regenerateCRC = true;
        }

        let txIdNuevo = null;
        if (opcionesRetransmision.regenerateCRC) {
            let nuevoNPO = 'RTX' + pedido.crc.substring(0, 8) + '-' + Date.fedicomTimestamp() + '-' + Math.random().toString(36).substring(2, 10).toUpperCase();
            L.xd(txIdRetransmision, ['Se fuerza la regeneración aleatoria del NumeroPedidoOrigen y CRC del pedido. [' + pedido.numeroPedidoOrigen + '] => [' + nuevoNPO + ']']);
            pedido.numeroPedidoOrigen = nuevoNPO;
            pedido.generarCRC();

            // Si cambia el CRC, nunca actualizaremos el pedido original sino que generaremos
            // una nueva transmisión con su propio TxId
            opcionesRetransmision.noActualizarOriginal = true;

            // Creamos un clon de la request y lo emitimos como un nuevo inicio de pedido
            let req = extensionesExpress.extenderSolicitudRetransmision(dbTx.clientRequest);
            req.body.numeroPedidoOrigen = nuevoNPO;

            txIdNuevo = req.txId;
            opcionesRetransmision.ctxId = txIdNuevo;

            L.xi(txIdRetransmision, ['La retransmisión resultará en la generación de una nueva transmisión con TxID [' + txIdNuevo + ']']);
            L.xi(txIdOriginal, ['Se ha generado un clon de la transmisión con ID [' + txIdNuevo + ']']);
            L.xi(txIdNuevo, ['Se inicia esta transmisión como clon de [' + txIdOriginal + '], generado por la retransmisión [' + txIdRetransmision + ']']);

            // Este evento crea la transccion como RECEPCIONADA.
            // La posterior emisión de iEventos.retransmisiones.retransmitirPedido es la que completará
            // el estado de la misma con la respuesta de SAP y la nueva respuesta del cliente.
            iEventos.retransmisiones.clonarPedido(req, pedido);
        }


        pedido.limpiarEntrada(txIdNuevo || txIdOriginal);
        L.xi(txIdRetransmision, ['Transmitimos a SAP el pedido']);

        iSap.retransmitirPedido(pedido, (errorSap, respuestaSap, solicitudASap) => {

            respuestaSap = _construyeRespuestaSap(errorSap, respuestaSap);

            if (errorSap) {
                if (errorSap.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
                    let errorFedicom = new ErrorFedicom('HTTP-400', errorSap.code, 400);
                    L.xe(txIdRetransmision, ['No se puede retransmitir porque no se encuentra el sistema SAP destino']);
                    iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.OK, null, {
                        sapRequest: solicitudASap,
                        sapResponse: respuestaSap,
                        clientResponse: _construyeRespuestaCliente(txIdNuevo || txIdOriginal, 400, errorFedicom.getErrors()),
                        status: K.TX_STATUS.PETICION_INCORRECTA
                    });
                    L.xi(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con éxito']);
                    L.xi(txIdRetransmision, ['Finaliza la retransmisión']);
                    return callback(null, txIdRetransmision, txIdNuevo);

                } else {
                    L.xe(txIdRetransmision, ['Incidencia en la comunicación con SAP - Se simulan las faltas del pedido', errorSap]);
                    pedido.simulaFaltas();

                    iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.OK, null, {
                        sapRequest: solicitudASap,
                        sapResponse: respuestaSap,
                        clientResponse: _construyeRespuestaCliente(txIdNuevo || txIdOriginal, 201, pedido),
                        status: K.TX_STATUS.NO_SAP
                    });

                    L.xi(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con éxito']);
                    L.xi(txIdRetransmision, ['Finaliza la retransmisión']);
                    return callback(null, txIdRetransmision, txIdNuevo);
                }
            }

            let respuestaCliente = pedido.obtenerRespuestaCliente(txIdNuevo || txIdOriginal, respuestaSap.body);
            let [estadoTransmision, numeroPedidoAgrupado, numerosPedidoSAP] = respuestaCliente.estadoTransmision();
            let codigoEstadoHTTP = respuestaCliente.isRechazadoSap() ? 409 : 201;

            iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.OK, null, {
                sapRequest: solicitudASap,
                sapResponse: respuestaSap,
                clientResponse: _construyeRespuestaCliente(txIdNuevo || txIdOriginal, codigoEstadoHTTP, respuestaCliente),
                status: estadoTransmision,
                numerosPedidoSAP: numerosPedidoSAP,
                numeroPedidoAgrupado: numeroPedidoAgrupado
            });

            L.xi(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con éxito']);
            return callback(null, txIdRetransmision, txIdNuevo);
        });

    });

}

/**
 * Construye el campo 'sapResponse' de la transmisión para almacenarlo en MongoDB
 * @param {*} errorSap 
 * @param {*} respuestaSap 
 */
const _construyeRespuestaSap = (errorSap, respuestaSap) => {

    if (errorSap) {
        switch (errorSap.type) {
            case K.ISAP.ERROR_TYPE_NO_SAPSYSTEM:
                return null;
            default:
                return {
                    timestamp: new Date(),
                    error: {
                        source: K.ISAP.errorToString(errorSap.type),
                        statusCode: (errorSap.errno || errorSap.errno === 0) ? errorSap.errno : null,
                        message: errorSap.code
                    }
                };
        }
    }

    return {
        timestamp: new Date(),
        statusCode: respuestaSap.statusCode,
        headers: respuestaSap.headers,
        body: respuestaSap.body
    }

}

const _construyeRespuestaCliente = (txId, codigoEstadoHttp, cuerpoRespuesta) => {
    return {
        timestamp: new Date(),
        statusCode: codigoEstadoHttp,
        headers: {
            'x-txid': txId,
            'software-id': K.SOFTWARE_ID.HEFAME,
            'content-api-version': K.PROTOCOL_VERSION,
            'content-type': 'application/json; charset=utf-8',
            'content-length': cuerpoRespuesta ? '' + cuerpoRespuesta.length : '0'
        },
        body: cuerpoRespuesta
    };
}

const _esRetransmisible = (dbTx, forzar) => {

    if (estadosRetransmitibles.includes(dbTx.status))
        return [true, null, 'El estado de la transmisión es válido para ser retransmitido'];

    if (estadosRetransmitiblesForzando.includes(dbTx.status)) {
        if (forzar)
            return [true, null, 'El estado de la transmisión es válido para ser retransmitido porque se está forzando'];
        else
            return [false, K.TX_STATUS.RETRANSMISION.SOLO_FORZANDO, 'El estado de la retransmisión solo permite retransmitirla forzando'];
    }

    return [false, K.TX_STATUS.RETRANSMISION.IMPOSIBLE, 'El estado de la transmisión no admite retransmitirla en ningún caso'];
}


module.exports = {
    retransmitirPedido
};