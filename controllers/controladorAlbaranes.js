'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iSap = require('interfaces/isap/iSap');

// Modelos
const CRC = require('model/CRC');
const ErrorFedicom = require('model/ModeloErrorFedicom');
const ConsultaAlbaran = require('model/albaran/ModeloConsultaAlbaran');
const Albaran = require('model/albaran/ModeloAlbaran');
const ConfirmacionAlbaran = require('model/albaran/ModeloConfirmacionAlbaran');



const _consultaAlbaranPDF = (req, res, numAlbaran) => {

    let txId = req.txId;

    iSap.albaranes.consultaAlbaranPDF(txId, numAlbaran, (errorSap, respuestaSap) => {
        if (errorSap) {
            if (errorSap.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
                L.xe(txId, ['Error al consultar el albarán PDF', errorSap]);
                let errorFedicom = new ErrorFedicom('HTTP-400', errorSap.code, 400);
                errorFedicom.enviarRespuestaDeError(res);
                return;
            }
            else {
                // Cuando el albarán no existe, SAP devuelve un 503 
                if (respuestaSap.statusCode === 503) {
                    L.xe(txId, ['SAP devolvió un 503, probablemente el albarán no existe', errorSap]);
                    let errorFedicom = new ErrorFedicom('ALB-ERR-001', 'El albarán solicitado no existe', 404);
                    errorFedicom.enviarRespuestaDeError(res);
                    return;
                }
                L.xe(txId, ['Ocurrió un error en la comunicación con SAP mientras se consultaba el albarán PDF', errorSap]);
                let errorFedicom = new ErrorFedicom('ALB-ERR-999', 'Ocurrió un error en la búsqueda del albarán', 500);
                errorFedicom.enviarRespuestaDeError(res);
                return;
            }
        }

        let cuerpoSap = respuestaSap.body;

        if (cuerpoSap && cuerpoSap[0] && cuerpoSap[0].pdf_file) {
            L.xi(txId, ['Se obtuvo el albarán PDF en Base64 desde SAP']);
            let buffer = Buffer.from(cuerpoSap[0].pdf_file, 'base64');

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=' + numAlbaran + '.pdf');
            res.status(200).send(buffer);
        }
        else {
            L.xe(txId, ['Ocurrió un error al solicitar el albarán PDF', cuerpoSap]);
            let errorFedicom = new ErrorFedicom('ALB-ERR-001', 'No se encontró el albarán', 404);
            errorFedicom.enviarRespuestaDeError(res);
        }

    });
}

const _consultaAlbaranJSON = (req, res, numAlbaran, asArray) => {
    let txId = req.txId;

    iSap.albaranes.consultaAlbaranJSON(txId, numAlbaran, (errorSap, respuestaSap) => {

        if (errorSap) {
            if (errorSap.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
                L.xe(txId, ['Error al consultar albarán JSON', errorSap]);
                let errorFedicom = new ErrorFedicom('HTTP-400', errorSap.code, 400);
                errorFedicom.enviarRespuestaDeError(res);
                return;
            }
            else {
                // Cuando el albarán no existe, SAP devuelve un 503 
                if (respuestaSap && respuestaSap.statusCode === 503) {
                    L.xe(txId, ['SAP devolvió un 503, probablemente el albarán no existe', errorSap]);
                    let errorFedicom = new ErrorFedicom('ALB-ERR-001', 'El albarán solicitado no existe', 404);
                    errorFedicom.enviarRespuestaDeError(res);
                    return;
                }
                L.xe(txId, ['Ocurrió un error en la comunicación con SAP mientras se consultaba el albarán JSON', errorSap]);
                let errorFedicom = new ErrorFedicom('ALB-ERR-999', 'Ocurrió un error en la búsqueda del albarán', 500);
                errorFedicom.enviarRespuestaDeError(res);
                return;
            }
        }

        let cuerpoSap = respuestaSap.body;

        if (cuerpoSap && cuerpoSap.t_pos) {
            let datosAlbaran = new Albaran(cuerpoSap)
            if (asArray) datosAlbaran = [datosAlbaran]
            res.status(200).json(datosAlbaran);
        } else {
            L.xe(txId, ["SAP no ha devuelto albaranes", cuerpoSap]);
            let errorFedicom = new ErrorFedicom('ALB-ERR-001', 'El albarán solicitado no existe', 404);
            errorFedicom.enviarRespuestaDeError(res);
        }
    })
}

// GET /albaranes/:numeroAlbaran
const consultaAlbaran = (req, res) => {

    let txId = req.txId;
    L.xi(txId, ['Procesando transmisión como CONSULTA DE ALBARAN']);

    // Verificación del token del usuario
    let estadoToken = iTokens.verificaPermisos(req, res, {
        admitirSimulaciones: true,
        admitirSimulacionesEnProduccion: true
    });
    if (!estadoToken.ok) return;


    // Saneado del número del albarán
    let numAlbaran = req.params.numeroAlbaran;
    if (!numAlbaran) {
        let errorFedicom = new ErrorFedicom('ALB-ERR-003', 'El parámetro "numeroAlbaran" es obligatorio', 400);
        errorFedicom.enviarRespuestaDeError(res);
        return;
    }
    let numAlbaranSaneado = numAlbaran.padStart(10, '0');
    L.xi(txId, ['El número de albarán solicitado', numAlbaranSaneado])


    // Detección del formato solicitado
    let formatoAlbaran = 'JSON';

    if (req.headers['accept']) {
        switch (req.headers['accept'].toLowerCase()) {
            case 'application/pdf': formatoAlbaran = 'PDF'; break;
            default: formatoAlbaran = 'JSON'; break;
        }
    }

    L.xd(txId, ['Se determina el formato solicitado del albarán', formatoAlbaran, req.headers['accept']]);

    switch (formatoAlbaran) {
        case 'JSON':
            return _consultaAlbaranJSON(req, res, numAlbaranSaneado);
        case 'PDF':
            return _consultaAlbaranPDF(req, res, numAlbaranSaneado);
        default:
            let errorFedicom = new ErrorFedicom('ALB-ERR-999', 'No se reconoce del formato de albarán en la cabecera "Accept"', 400);
            errorFedicom.enviarRespuestaDeError(res);
            return;
    }

}


// GET /albaranes
const listadoAlbaranes = (req, res) => {

    let txId = req.txId;

    L.xi(txId, ['Procesando transmisión como BÚSQUEDA DE ALBARAN']);

    // Verificación del token del usuario
    let estadoToken = iTokens.verificaPermisos(req, res, {
        admitirSimulaciones: true,
        admitirSimulacionesEnProduccion: true
    });
    if (!estadoToken.ok) return;


    // En el caso de que se busque por un numeroAlbaran concreto hacemos la búsqueda de ese albaran JSON concreto
    // usando el método de obtener un único albarán en JSON
    if (req.query.numeroAlbaran) {
        let numAlbaran = req.query.numeroAlbaran.padStart(10, '0');
        _consultaAlbaranJSON(req, res, numAlbaran, true /*Responder en un array*/);
        return;
    }


    // #1 - Saneado del código del cliente
    let codigoCliente = req.query.codigoCliente
    if (!codigoCliente) {
        let errorFedicom = new ErrorFedicom('ALB-ERR-002', 'El "codigoCliente" es inválido.', 400);
        /*let responseBody =*/ errorFedicom.enviarRespuestaDeError(res);
        return;
    }
    codigoCliente = codigoCliente.padStart(10, '0');

    // #2 - Limpieza de offset y limit
    let limit = parseInt(req.query.limit || 50);
    if (limit > 50 || limit <= 0) {
        let errorFedicom = new ErrorFedicom('ALB-ERR-008', 'El campo "limit" es inválido', 400);
        /*let responseBody =*/ errorFedicom.enviarRespuestaDeError(res);
        return;
    }

    let offset = parseInt(req.query.offset || 0);
    if (offset < 0) {
        let errorFedicom = new ErrorFedicom('ALB-ERR-007', 'El campo "offset" es inválido', 400);
        /*let responseBody =*/ errorFedicom.enviarRespuestaDeError(res);
        return;
    }


    // #3 - Limpieza de Fechas
    // Si viene fechaAlbaran, esta manda sobre el resto.
    // De lo contrario, se usa fechaDesde/fechaHasta. Si alguno no aparece, se establece a la fecha actual.
    let fechaAlbaran = Date.fromFedicomDate(req.query.fechaAlbaran);
    let fechaDesde, fechaHasta;
    if (fechaAlbaran) {
        fechaDesde = fechaHasta = fechaAlbaran;
    } else {

        // Si no se especifica la fechaHasta, se establece la fecha máxima el momento actual.
        fechaHasta = Date.fromFedicomDate(req.query.fechaHasta) || new Date();
        // Si no se especifica la fechaDesde, se establece a un año atrás, desde la fechaHasta.
        fechaDesde = Date.fromFedicomDate(req.query.fechaDesde) || new Date(new Date(fechaHasta).setFullYear(fechaHasta.getFullYear() - 1));

        // Si hay que invertir las fechas ....
        if (fechaDesde.getTime() > fechaHasta.getTime()) {
            let tmp = fechaDesde;
            fechaDesde = fechaHasta;
            fechaHasta = tmp;
        }

        // Comprobación de rango inferior a 1 año
        let diff = (fechaHasta.getTime() - fechaDesde.getTime()) / 1000;
        if (diff > 31622400) { // 366 dias * 24h * 60m * 60s
            let errorFedicom = new ErrorFedicom('ALB-ERR-009', 'El intervalo entre el parámetro "fechaDesde" y "fechaHasta" no puede ser superior a un año', 400);
            /*let responseBody =*/ errorFedicom.enviarRespuestaDeError(res);
            return;
        }
    }



    let consulta = new ConsultaAlbaran(codigoCliente)
    consulta.setLimit(limit)
        .setOffset(offset)
        .setFechas(fechaDesde, fechaHasta);




    // #4 - El cliente filtra por numeroPedidoOrigen
    let numeroPedidoOrigen = req.query.numeroPedidoOrigen;
    if (numeroPedidoOrigen) {
        // El codigo de cliente con el que se crean los pedidos es el corto, por lo que deberemos
        // convertir el que nos viene a corto para generar el mismo CRC
        let codigoClienteOrigen = parseInt(codigoCliente.slice(-5)) ;
        let crc = CRC.crear(codigoClienteOrigen, numeroPedidoOrigen);
        consulta.setNumeroPedidoOrigen(numeroPedidoOrigen, crc);
    }

    // #5 - El cliente filtra por numeroPedido (de distribuidor)
    // En este caso, nos pasan el CRC del pedido
    let numeroPedido = req.query.numeroPedido;
    if (numeroPedido) {
        consulta.setCrc(numeroPedido)
    }

    L.xd(txId, ['Buscando en SAP albaranes con filtro', consulta.toQueryString()], 'recopilaAlb');

    iSap.albaranes.listadoAlbaranes(txId, consulta, (errorSap, respuestaSap) => {
        if (errorSap) {
            if (errorSap.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
                L.xe(txId, ['Error al consultar el listado de albaranes', errorSap]);
                let errorFedicom = new ErrorFedicom('HTTP-400', errorSap.code, 400);
                errorFedicom.enviarRespuestaDeError(res);
            }
            else {
                L.xe(txId, ['Ocurrió un error al buscar albaranes en SAP', errorSap]);
                let errorFedicom = new ErrorFedicom('ALB-ERR-999', 'Ocurrió un error en la búsqueda de albaranes', 500);
                errorFedicom.enviarRespuestaDeError(res);
                return;
            }
            return;
        }

        let cuerpoSap = respuestaSap.body;

        if (cuerpoSap && cuerpoSap.tot_rec >= 0 && cuerpoSap.t_data && cuerpoSap.t_data.forEach) {

            L.xi(txId, ["SAP ha devuelto albaranes", cuerpoSap.t_data.length]);

            let albaranesSimples = cuerpoSap.t_data.map( albaranSap => new Albaran(albaranSap));


            res.setHeader('X-Total-Count', cuerpoSap.tot_rec);
            res.status(200).send(albaranesSimples);

        } else {

            L.xe(txId, ["SAP no ha devuelto albaranes", cuerpoSap])
            res.setHeader('X-Total-Count', 0);
            res.status(200).json([]);

        }
    });

}

// POST /albaranes/confirmacion
const confirmacionAlbaran = (req, res) => {

    let txId = req.txId;
    L.xi(txId, ['Procesando transmisión como CONFIRMACION DE ALBARAN']);

    // Verificación del token del usuario
    let estadoToken = iTokens.verificaPermisos(req, res, {
        admitirSimulaciones: true,
        simulacionRequiereSolicitudAutenticacion: true,
        admitirSimulacionesEnProduccion: false
    });
    if (!estadoToken.ok) return;



    let confirmacionAlbaran = null;
    L.xd(txId, ['Analizando el contenido de la transmisión']);
    try {
        confirmacionAlbaran = new ConfirmacionAlbaran(req);
    } catch (excepcion) {
        let errorFedicom = ErrorFedicom.desdeExcepcion(txId, excepcion);
        L.xe(txId, ['Ocurrió un error al analizar la petición', errorFedicom]);
        /*let cuerpoRespuesta = */errorFedicom.enviarRespuestaDeError(res);
        // iEventos....
        return;
    }

    L.xd(txId, ['El contenido de la transmisión es una solicitud de confirmacion de albarán correcta', confirmacionAlbaran]);
    res.status(200).json(confirmacionAlbaran);
    //iEventos....

}

module.exports = {
    consultaAlbaran,
    listadoAlbaranes,
    confirmacionAlbaran
}