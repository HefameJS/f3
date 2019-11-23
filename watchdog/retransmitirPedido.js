'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

const Imongo = require(BASE + 'interfaces/imongo');
const Isap = require(BASE + 'interfaces/isap');
const emitRetransmision = require(BASE + 'interfaces/events').retransmisiones.emitRetransmision;
const ObjectID = Imongo.ObjectID;

const FedicomError = require(BASE + 'model/fedicomError');
const txTypes = require(BASE + 'model/static/txTypes');
const Pedido = require(BASE + 'model/pedido/pedido');

const estadosRetransmitibles = [
    K.TX_STATUS.RECEPCIONADO,
    K.TX_STATUS.ESPERANDO_INCIDENCIAS,
    K.TX_STATUS.INCIDENCIAS_RECIBIDAS,
    K.TX_STATUS.PEDIDO.NO_SAP
];

const estadosRetransmitiblesForzando = [
    K.TX_STATUS.OK,
    K.TX_STATUS.PETICION_INCORRECTA,
    K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO,
    K.TX_STATUS.PEDIDO.RECHAZADO_SAP,
    K.TX_STATUS.PEDIDO.ESPERA_AGOTADA,
    K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP
];

/**
 * Retransmite un pedido.
 * 
 * @param {string} txId El ID de transmisión del pedido a retransmitir
 * @param {object} options Opciones de la retransmisión
 */
const retransmitirPedido = function (txId, options, callback) {
    if (!options) options = {};
    
    options.force = options.force ? options.force : false;
    options.regenerateCRC = options.regenerateCRC ? options.regenerateCRC : false;
    options.forzarAlmacen = options.forzarAlmacen ? options.forzarAlmacen : undefined;
    options.sistemaSAP = options.sistemaSAP ? options.sistemaSAP : undefined;
    options.noActualizarOriginal = options.noActualizarOriginal ? options.noActualizarOriginal : false;

    let rtxId = new ObjectID();

    L.xi(rtxId, ['Retransmisión de pedido con ID ' + txId, options]);

    Imongo.findTxById(rtxId, txId, function (err, dbTx) {
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
        L.xi(txId, ['Se lanza la retransmisión con ID ' + rtxId + ' para esta transmisión']);

        // La transmisión a retransmitir no es un pedido
        if (dbTx.type !== txTypes.CREAR_PEDIDO) {
            var errorMessage = 'La transmisión indicada no es un pedido';
            L.xe(rtxId, [errorMessage, dbTx.type]);
            L.xw(txId, ['La retransmisión con ID ' + rtxId + ' finaliza con errores', errorMessage]);
            emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.IMPOSIBLE, errorMessage)
            return callback(errorMessage, rtxId);
        } 
        L.xt(txId, ['La transmisión es de tipo CREAR PEDIDO']);

        // Comprobamos que tenemos toda la información de la petición original necesaria. 
        if (!dbTx.clientRequest || !dbTx.clientRequest.body || !dbTx.clientRequest.authentication) {
            var errorMessage = 'La transmisión no tiene guardada toda la transmisión HTTP original necesaria';
            L.xf(rtxId, [errorMessage, dbTx]);
            L.xe(txId, ['La retransmisión con ID ' + rtxId + ' finaliza con errores', errorMessage]);
            emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.IMPOSIBLE, errorMessage)
            return callback(errorMessage, rtxId);
        }
        L.xt(rtxId, ['Tenemos todos los campos necesarios para la retransmisión']);

        var [ retransmisible, estadoError, mensajeError ] = isRetransmitible(dbTx, options.force);
        if (!retransmisible) {
            L.xe(rtxId, [mensajeError, estadoError, dbTx.status]);
            L.xe(txId, ['La retransmisión con ID ' + rtxId + ' finaliza con errores', errorMessage]);
            emitRetransmision(rtxId, dbTx, options, estadoError, mensajeError)
            return callback(mensajeError, rtxId);
        }
        L.xt(rtxId, ['La transmisión es válida para ser retransmitida']);

        // Recreamos el pedido, tal y como vendría en la petición original
        // Es decir, hacemos pasar 'dbTx.clientRequest' por la variable 'req' original.
        // Para esto, necesitaremos que existan los campos 'body', 'txId' y 'token'
        var pedido = null;
        try {
            dbTx.clientRequest.txId = dbTx.txId;
            dbTx.clientRequest.token = dbTx.clientRequest.authentication;
            var pedido = new Pedido(dbTx.clientRequest);
        } catch (fedicomError) {
            fedicomError = FedicomError.fromException(rtxId, fedicomError);
            L.xe(rtxId, ['Ocurrió un error al analizar la petición', fedicomError])
            emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.OK, null, {
                clientResponse: fedicomError.getErrors(),
                status: K.TX_STATUS.PETICION_INCORRECTA
            });
            L.xi(txId, ['La retransmisión con ID ' + rtxId + ' finaliza con éxito']);
            return callback(null, rtxId);
        }
        L.xt(rtxId, ['El contenido de la transmisión es un pedido correcto', pedido]);
        

        if (options.sistemaSAP) {
            L.xd(rtxId, ['Se cambia el sistema SAP al que enviamos el pedido [' + (pedido.sap_system || '<n/a>') + '] => [' + options.sistemaSAP + ']']);
            pedido.sap_system = options.sistemaSAP;
            // Si cambia el sistema SAP, nunca actualizaremos el pedido original
            options.noActualizarOriginal = true;
        }

        if (options.forzarAlmacen) {
            L.xd(rtxId, ['Se fuerza el cambio del almacén del pedido [' + (pedido.codigoAlmacenServicio || '<n/a>') + '] => ['+ options.forzarAlmacen + ']']);
            pedido.codigoAlmacenServicio = options.forzarAlmacen;
        }

        if (options.regenerateCRC) {
            var nuevoNPO = 'RTX-' + Date.fedicomTimestamp() + '-' + Math.random().toString(36).substring(2,10).toUpperCase();
            L.xd(rtxId, ['Se fuerza la regeneración aleatoria del CRC del pedido. [' + pedido.numeroPedidoOrigen + '] => [' + nuevoNPO + ']']);
            pedido.numeroPedidoOrigen = nuevoNPO;
            pedido.generarCRC();

            // Si cambia el CRC, nunca actualizaremos el pedido original
            // TODO: Lo ideal aquí sería crear una nueva TX de pedido
            options.noActualizarOriginal = true;
        }


        pedido.limpiarEntrada();
        L.xi(rtxId, ['Retransmitimos a SAP el pedido']);

        Isap.retransmitirPedido(pedido, (sapError, sapResponse, sapBody, sapRequest) => {

            sapResponse = construyeSapResponse(sapError, sapResponse, sapBody);

            if (sapError) {
                if (sapError.type = K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
                    var fedicomError = new FedicomError('HTTP-400', sapError.code, 400);
                    L.xe(rtxId, ['No se puede retransmitir porque no se encuentra el sistema SAP destino']);
                    emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.OK, null, {
                        sapRequest: sapRequest,
                        sapResponse: sapResponse,
                        clientResponse: construyeClientResponse(txId, 400, fedicomError.getErrors()),
                        status: K.TX_STATUS.PETICION_INCORRECTA
                    });
                    L.xi(txId, ['La retransmisión con ID ' + rtxId + ' finaliza con éxito']);
                    return callback(null, rtxId);

                } else {
                    L.xe(rtxId, ['Incidencia en la comunicación con SAP - Se simulan las faltas del pedido', sapError]);
                    pedido.simulaFaltas();
                    
                    emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.OK, null, {
                        sapRequest: sapRequest,
                        sapResponse: sapResponse,
                        clientResponse: construyeClientResponse(txId, 201, pedido),
                        status: K.TX_STATUS.PEDIDO.NO_SAP
                    });

                    L.xi(txId, ['La retransmisión con ID ' + rtxId + ' finaliza con éxito']);
                    return callback(null, rtxId);
                }
            }


            var clientResponse = pedido.obtenerRespuestaCliente(sapBody);
            var [estadoTransmision, numeroPedidoAgrupado, numerosPedidoSAP] = clientResponse.estadoTransmision();
            var responseHttpStatusCode = clientResponse.isRechazadoSap() ? 409 : 201;

            emitRetransmision(rtxId, dbTx, options, K.TX_STATUS.RETRANSMISION.OK, null, {
                sapRequest: sapRequest,
                sapResponse: sapResponse,
                clientResponse: construyeClientResponse(txId, responseHttpStatusCode, clientResponse),
                status: estadoTransmision,
                numerosPedidoSAP: numerosPedidoSAP,
                numeroPedidoAgrupado: numeroPedidoAgrupado
            });

            L.xi(txId, ['La retransmisión con ID ' + rtxId + ' finaliza con éxito']);
            return callback(null, rtxId);
        });
        
    });

}

const construyeSapResponse = (callError, httpResponse, body) => {

    if (callError) {
        switch (callError.type) {
            case K.ISAP.ERROR_TYPE_NO_SAPSYSTEM:
                return null;
            default:
                return {
                    timestamp: new Date(),
                    error: {
                        source: K.ISAP.errorToString(error.type),
                        statusCode: (error.errno || error.errno === 0) ? error.errno : null,
                        message: error.code
                    }
                };
        }
    }

    return {
        timestamp: new Date(),
        statusCode: httpResponse.statusCode,
        headers: httpResponse.headers,
        body: body
    }

}

const construyeClientResponse = (txId, responseStatus, responseBody) => {
    return {
        timestamp: new Date(),
        statusCode: responseStatus,
        headers: {
            'x-txid': txId,
            'software-id': K.SOFTWARE_ID.HEFAME,
            'content-api-version': K.PROTOCOL_VERSION,
            'content-type': 'application/json; charset=utf-8',
            'content-length': responseBody ? ''+responseBody.length : '0'
        },
        body: responseBody
    };
}

const isRetransmitible = (dbTx, force) => {

    if (estadosRetransmitibles.includes(dbTx.status))
        return [true, null, 'El estado de la transmisión es válido para ser retransmitido'];

    if (estadosRetransmitiblesForzando.includes(dbTx.status)) {
        if (force) 
            return [true, null, 'El estado de la transmisión es válido para ser retransmitido porque se está forzando'];
        else
            return [false, K.TX_STATUS.RETRANSMISION.SOLO_FORZANDO, 'El estado de la retransmisión solo permite retransmitirla forzando'];
    }

    return [false, K.TX_STATUS.RETRANSMISION.IMPOSIBLE, 'El estado de la transmisión no admite retransmitirla en ningún caso'];
}


module.exports = {
    retransmitirPedido: retransmitirPedido
};