'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo');
const iSap = require(BASE + 'interfaces/isap');
const iEventos = require(BASE + 'interfaces/eventos/iEventos');

// Modelos
const ObjectID = iMongo.ObjectID;
const FedicomError = require(BASE + 'model/fedicomError');
const Pedido = require(BASE + 'model/pedido/ModeloPedido');

// Helpers
const expressExtensions = require(BASE + 'util/expressExtensions');
const emitRetransmision = iEventos.retransmisiones.emitRetransmision;


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
 * @param {object} options Opciones de la retransmisión
 */
const retransmitirPedido = function (otxId, options, callback) {
    if (!options) options = {};

    options.force = options.force ? options.force : false;
    options.regenerateCRC = options.regenerateCRC ? options.regenerateCRC : false;
    options.forzarAlmacen = options.forzarAlmacen ? options.forzarAlmacen : undefined;
    options.sistemaSAP = options.sistemaSAP ? options.sistemaSAP : undefined;
    options.noActualizarOriginal = options.noActualizarOriginal ? options.noActualizarOriginal : false;

    let rtxId = new ObjectID();

    L.xi(rtxId, ['Retransmisión de pedido con ID ' + otxId, options]);

    iMongo.findTxById(rtxId, otxId, function (err, dbTx) {
        // Comprobación de error en la búsqueda
        if (err) {
            var errorMessage = 'Ocurrió un error al buscar la transmisión en la base de datos';
            L.xe(rtxId, [errorMessage, err]);
            return callback(errorMessage, rtxId);
        }

        // No se encuentra la transmisión a retransmitir
        if (!dbTx) {
            var errorMessage = 'No se encontró la transmisión en la base de datos';
            L.xe(rtxId, [errorMessage]);
            return callback(errorMessage, rtxId);
        }

        // Escribimos en el log de la transmisión original, ahora que sabemos que existe:
        L.xi(otxId, ['Se lanza la retransmisión con ID ' + rtxId + ' para esta transmisión']);

        // La transmisión a retransmitir no es un pedido
        if (dbTx.type !== K.TX_TYPES.PEDIDO) {
            var errorMessage = 'La transmisión indicada no es un pedido';
            L.xe(rtxId, [errorMessage, dbTx.type]);
            L.xw(otxId, ['La retransmisión con ID ' + rtxId + ' finaliza con errores', errorMessage]);
            emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.IMPOSIBLE, errorMessage)
            return callback(errorMessage, rtxId);
        }
        L.xt(rtxId, ['OK: La transmisión es de tipo CREAR PEDIDO']);

        // Comprobamos que tenemos toda la información de la petición original necesaria. 
        if (!dbTx.clientRequest || !dbTx.clientRequest.body || !dbTx.clientRequest.authentication) {
            var errorMessage = 'La transmisión no tiene guardada toda la transmisión HTTP original necesaria';
            L.xf(rtxId, [errorMessage, dbTx]);
            L.xe(otxId, ['La retransmisión con ID ' + rtxId + ' finaliza con errores', errorMessage]);
            emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.IMPOSIBLE, errorMessage)
            return callback(errorMessage, rtxId);
        }
        L.xt(rtxId, ['OK: Tenemos todos los campos necesarios para la retransmisión']);

        var [retransmisible, estadoError, mensajeError] = _esRetransmisible(dbTx, options.force);
        if (!retransmisible) {
            L.xe(rtxId, [mensajeError, estadoError, dbTx.status]);
            L.xe(otxId, ['La retransmisión con ID ' + rtxId + ' finaliza con errores', errorMessage]);
            emitRetransmision(rtxId, dbTx, options, estadoError, mensajeError)
            return callback(mensajeError, rtxId);
        }
        L.xt(rtxId, ['OK: La transmisión es válida para ser retransmitida']);

        // Recreamos el pedido, tal y como vendría en la petición original
        // Es decir, hacemos pasar 'dbTx.clientRequest' por la variable 'req' original.
        // Para esto, necesitaremos que existan los campos 'body', 'txId' y 'token'
        var pedido = null;
        try {
            dbTx.clientRequest.txId = dbTx._id;
            dbTx.clientRequest.token = dbTx.clientRequest.authentication;
            var pedido = new Pedido(dbTx.clientRequest);
        } catch (fedicomError) {
            fedicomError = FedicomError.fromException(rtxId, fedicomError);
            L.xe(rtxId, ['Ocurrió un error al analizar la petición', fedicomError])
            emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.OK, null, {
                clientResponse: fedicomError.getErrors(),
                status: K.TX_STATUS.PETICION_INCORRECTA
            });
            L.xi(otxId, ['La retransmisión con ID ' + rtxId + ' finaliza en estado de PETICION INCORRECTA']);
            return callback(null, rtxId);
        }
        L.xt(rtxId, ['OK: El contenido de la transmisión es un pedido correcto', pedido]);


        if (options.sistemaSAP) {
            L.xd(rtxId, ['Se cambia el sistema SAP al que enviamos el pedido [' + (pedido.sapSystem || '<n/a>') + '] => [' + options.sistemaSAP + ']']);
            pedido.sapSystem = options.sistemaSAP;

            // Si cambia el sistema SAP, forzamos la regeneración del CRC y por tanto la creación de una transmisión nueva
            options.regenerateCRC = true;
        }

        if (options.forzarAlmacen) {
            L.xd(rtxId, ['Se fuerza el cambio del almacén del pedido [' + (pedido.codigoAlmacenServicio || '<n/a>') + '] => [' + options.forzarAlmacen + ']']);
            pedido.codigoAlmacenServicio = options.forzarAlmacen;

            // Si cambia el sistema SAP, forzamos la regeneración del CRC y por tanto la creación de una transmisión nueva
            options.regenerateCRC = true;
        }

        let ctxId = null;
        if (options.regenerateCRC) {
            var nuevoNPO = 'RTX' + pedido.crc.substring(0, 8) + '-' + Date.fedicomTimestamp() + '-' + Math.random().toString(36).substring(2, 10).toUpperCase();
            L.xd(rtxId, ['Se fuerza la regeneración aleatoria del NumeroPedidoOrigen y CRC del pedido. [' + pedido.numeroPedidoOrigen + '] => [' + nuevoNPO + ']']);
            pedido.numeroPedidoOrigen = nuevoNPO;
            pedido.generarCRC();

            // Si cambia el CRC, nunca actualizaremos el pedido original sino que generaremos
            // una nueva transmisión con su propio TxId
            options.noActualizarOriginal = true;

            // Creamos un clon de la request y lo emitimos como un nuevo inicio de pedido
            let req = expressExtensions.extendReqForRtx(dbTx.clientRequest);
            req.body.numeroPedidoOrigen = nuevoNPO;

            ctxId = req.txId;
            options.ctxId = ctxId;

            L.xi(rtxId, ['La retransmisión resultará en la generación de una nueva transmisión con TxID [' + ctxId + ']']);
            L.xi(otxId, ['Se ha generado un clon de la transmisión con ID [' + ctxId + ']']);
            L.xi(ctxId, ['Se inicia esta transmisión como clon de [' + otxId + '], generado por la retransmisión [' + rtxId + ']']);

            iEventos.retransmisiones.emitInicioClonarPedido(req, pedido, otxId);
        }


        pedido.limpiarEntrada(ctxId || otxId);
        L.xi(rtxId, ['Transmitimos a SAP el pedido']);



        iSap.retransmitirPedido(pedido, (sapError, sapResponse, sapRequest) => {

            sapResponse = _construyeRespuestaSap(sapError, sapResponse);

            if (sapError) {
                if (sapError.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
                    var fedicomError = new FedicomError('HTTP-400', sapError.code, 400);
                    L.xe(rtxId, ['No se puede retransmitir porque no se encuentra el sistema SAP destino']);
                    emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.OK, null, {
                        sapRequest: sapRequest,
                        sapResponse: sapResponse,
                        clientResponse: _construyeRespuestaCliente(ctxId || otxId, 400, fedicomError.getErrors()),
                        status: K.TX_STATUS.PETICION_INCORRECTA
                    });
                    L.xi(otxId, ['La retransmisión con ID ' + rtxId + ' finaliza con éxito']);
                    L.xi(rtxId, ['Finaliza la retransmisión']);
                    return callback(null, rtxId, ctxId);

                } else {
                    L.xe(rtxId, ['Incidencia en la comunicación con SAP - Se simulan las faltas del pedido', sapError]);
                    pedido.simulaFaltas();

                    emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.OK, null, {
                        sapRequest: sapRequest,
                        sapResponse: sapResponse,
                        clientResponse: _construyeRespuestaCliente(ctxId || otxId, 201, pedido),
                        status: K.TX_STATUS.NO_SAP
                    });

                    L.xi(otxId, ['La retransmisión con ID ' + rtxId + ' finaliza con éxito']);
                    L.xi(rtxId, ['Finaliza la retransmisión']);
                    return callback(null, rtxId, ctxId);
                }
            }

            var clientResponse = pedido.obtenerRespuestaCliente(ctxId || otxId, sapResponse.body);
            var [estadoTransmision, numeroPedidoAgrupado, numerosPedidoSAP] = clientResponse.estadoTransmision();
            var responseHttpStatusCode = clientResponse.isRechazadoSap() ? 409 : 201;

            emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.OK, null, {
                sapRequest: sapRequest,
                sapResponse: sapResponse,
                clientResponse: _construyeRespuestaCliente(ctxId || otxId, responseHttpStatusCode, clientResponse),
                status: estadoTransmision,
                numerosPedidoSAP: numerosPedidoSAP,
                numeroPedidoAgrupado: numeroPedidoAgrupado
            });

            L.xi(otxId, ['La retransmisión con ID ' + rtxId + ' finaliza con éxito']);
            return callback(null, rtxId, ctxId);
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