'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;


const FedicomError = require(BASE + 'model/fedicomError');
const Tokens = require(BASE + 'util/tokens');
const Isap = require(BASE + 'interfaces/isap');


const ConsultaAlbaran = require(BASE + '/model/albaran/ModeloConsultaAlbaran');
const AlbaranSimple = require(BASE + '/model/albaran/ModeloAlbaranSimple');
const AlbaranCompleto = require(BASE + '/model/albaran/ModeloAlbaranCompleto');

const _consultaAlbaranPDF = (req, res, numAlbaran) => {
    Isap.albaranes.consultaAlbaranPDF(req.txId, numAlbaran, (sapError, sapRes, sapBody) => {
        if (sapError) {
            if (sapError.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
                L.xe(txId, ['Error al consultar el albarán PDF', sapError]);
                let fedicomError = new FedicomError('HTTP-400', sapError.code, 400);
                fedicomError.send(res);
                return;
            }
            else {
                // Cuando el albarán no existe, SAP devuelve un 503 
                if (sapRes.statusCode === 503) {
                    L.xe(req.txId, ['SAP devolvió un 503, probablemente el albarán no existe', sapError]);
                    let error = new FedicomError('ALB-ERR-001', 'El albarán solicitado no existe', 404);
                    error.send(res);
                    return;
                }
                L.xe(req.txId, ['Ocurrió un error en la comunicación con SAP mientras se consultaba el albarán PDF', sapError]);
                var error = new FedicomError('ALB-ERR-999', 'Ocurrió un error en la búsqueda del albarán', 500);
                error.send(res);
                return;
            }
        }

        if (sapBody && sapBody[0] && sapBody[0].pdf_file) {
            L.xi(req.txId, ['Se obtuvo el albarán PDF en Base64 desde SAP']);
            var buffer = Buffer.from(sapBody[0].pdf_file, 'base64');
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=' + numAlbaran + '.pdf');
            res.status(200);
            res.send(buffer);
        }
        else {
            L.xe(req.txId, ['Ocurrió un error al solicitar el albarán PDF', sapBody]);
            var fedicomError = new FedicomError('ALB-ERR-001', 'No se encontró el albarán', 404);
            fedicomError.send(res);
        }

    });
}

const _consultaAlbaranJSON = (req, res, numAlbaran, asArray) => {
    Isap.albaranes.consultaAlbaranJSON(req.txId, numAlbaran, (sapError, sapRes, sapBody) => {
        if (sapError) {
            if (sapError.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
                L.xe(txId, ['Error al consultar albarán JSON', sapError]);
                let fedicomError = new FedicomError('HTTP-400', sapError.code, 400);
                fedicomError.send(res);
                return;
            }
            else {
                // Cuando el albarán no existe, SAP devuelve un 503 
                if (sapRes.statusCode === 503) {
                    L.xe(req.txId, ['SAP devolvió un 503, probablemente el albarán no existe', sapError]);
                    let error = new FedicomError('ALB-ERR-001', 'El albarán solicitado no existe', 404);
                    error.send(res);
                    return;
                }
                L.xe(req.txId, ['Ocurrió un error en la comunicación con SAP mientras se consultaba el albarán JSON', sapError]);
                var error = new FedicomError('ALB-ERR-999', 'Ocurrió un error en la búsqueda del albarán', 500);
                error.send(res);
                return;
            }
        }

        
        if (sapBody && sapBody.t_pos) {
            let datosAlbaran = new AlbaranCompleto(sapBody)
            if (asArray) datosAlbaran = [datosAlbaran]
            res.status(200).json(datosAlbaran);
        } else {
            L.xe(req.txId, ["SAP no ha devuelto albaranes", sapBody]);
            let error = new FedicomError('ALB-ERR-001', 'El albarán solicitado no existe', 404);
            error.send(res);
        }
    }) 
}

// GET /albaranes/:numeroAlbaran
exports.consultaAlbaran = (req, res) => {

    L.xi(req.txId, ['Procesando transmisión como CONSULTA DE ALBARAN']);

    // Verificación del token del usuario
    let estadoToken = Tokens.verificaPermisos(req, res, {
        admitirSimulaciones: true,
        admitirSimulacionesEnProduccion: true
    });
    if (!estadoToken.ok) return;


    // Saneado del número del albarán
    var numAlbaran = req.params.numeroAlbaran;
    if (!numAlbaran) {
        var error = new FedicomError('ALB-ERR-003', 'El parámetro "numeroAlbaran" es obligatorio', 400);
        error.send(res);
        return;
    }
    var numAlbaranSaneado = numAlbaran.padStart(10, '0');
    L.xi(req.txId, ['El número de albarán solicitado', numAlbaranSaneado])


    // Detección del formato solicitado
    var formatoAlbaran = 'JSON';

    if (req.headers['accept']) {
        switch (req.headers['accept'].toLowerCase()) {
            case 'application/pdf': formatoAlbaran = 'PDF'; break;
            default: formatoAlbaran = 'JSON'; break;
        }
    }

    L.xd(req.txId, ['Se determina el formato solicitado del albarán', formatoAlbaran, req.headers['accept']]);

    switch (formatoAlbaran) {
        case 'JSON':
            return _consultaAlbaranJSON(req, res, numAlbaranSaneado);
        case 'PDF':
            return _consultaAlbaranPDF(req, res, numAlbaranSaneado);
        default:
            var error = new FedicomError('ALB-ERR-999', 'No se reconoce del formato de albarán en la cabecera "Accept"', 400);
            error.send(res);
            return;
    }

}

// GET /albaranes
exports.listadoAlbaranes = (req, res) => {

    L.xi(req.txId, ['Procesando transmisión como BÚSQUEDA DE ALBARAN']);
    
    // Verificación del token del usuario
    let estadoToken = Tokens.verificaPermisos(req, res, {
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
        var error = new FedicomError('ALB-ERR-002', 'El "codigoCliente" es inválido.', 400);
        /*let responseBody =*/ error.send(res);
        return;
    }
    codigoCliente = codigoCliente.padStart(10, '0');

    // #2 - Limpieza de offset y limit
    let limit = parseInt(req.query.limit || 50);
    if (limit > 50 || limit <= 0) {
        let error = new FedicomError('ALB-ERR-008', 'El campo "limit" es inválido', 400);
        /*let responseBody =*/ error.send(res);
        return;
    }

    let offset = parseInt(req.query.offset || 0);
    if (offset < 0) {
        let error = new FedicomError('ALB-ERR-007', 'El campo "offset" es inválido', 400);
        /*let responseBody =*/ error.send(res);
        return;
    }


    // #3 - Limpieza de Fechas
    // Si viene fechaAlbaran, esta manda sobre el resto.
    // De lo contrario, se usa fechaDesde/fechaHasta. Si alguno no aparece, se establece a la fecha actual.
    let fechaAlbaran = Date.fromFedicomDate(req.query.fechaAlbaran);
    let fechaDesde, fechaHasta;
    if (fechaAlbaran) {
        fechaDesde = fechaHasta = Date.toSapDate(fechaAlbaran);
    } else {

        fechaDesde = Date.fromFedicomDate(req.query.fechaDesde) || new Date()
        fechaHasta = Date.fromFedicomDate(req.query.fechaHasta) || new Date()

        // Si hay que invertir las fechas
        if (fechaDesde.getTime() > fechaHasta.getTime()) {
            let tmp = fechaDesde;
            fechaDesde = fechaHasta;
            fechaHasta = tmp;
        }

        // Comprobación de rango inferior a 1 año
        let diff = (fechaHasta.getTime() - fechaDesde.getTime()) / 1000 ;
        if (diff > 31622400) { // 366 dias * 24h * 60m * 60s
            var error = new FedicomError('ALB-ERR-009', 'El intervalo entre el parámetro "fechaDesde" y "fechaHasta" no puede ser superior a un año', 400);
            /*let responseBody =*/ error.send(res);
            return;
        }

        fechaDesde = Date.toSapDate(fechaDesde)
        fechaHasta = Date.toSapDate(fechaHasta)
    }



    let consulta = new ConsultaAlbaran(codigoCliente)
    consulta.setLimit(limit)
            .setOffset(offset)
            .setFechas(fechaDesde, fechaHasta);

    // #4 - El cliente indica CRC ?
    let crc = req.query.numeroPedido;
    if (crc) {
        consulta.setCrc(crc)
    }
    

    L.xd(req.txId, ['Buscando en SAP albaranes con filtro', consulta.toQueryString()]);

    Isap.albaranes.listadoAlbaranes(req.txId, consulta, (sapError, sapRes, sapBody) => {
        if (sapError) {
            if (sapError.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
                L.xe(txId, ['Error al consultar el listado de albaranes', sapError]);
                var fedicomError = new FedicomError('HTTP-400', sapError.code, 400);
                fedicomError.send(res);
            }
            else {
                L.xe(req.txId, ['Ocurrió un error al buscar albaranes en SAP', sapError]);
                var error = new FedicomError('ALB-ERR-999', 'Ocurrió un error en la búsqueda de albaranes', 500);
                error.send(res);
                return;
            }
            return;
        }
        
        if (sapBody && sapBody.tot_rec >= 0 && sapBody.t_data && sapBody.t_data.forEach ) {
            let listaAlbaranesSimples = [];
            sapBody.t_data.forEach( datosAlbaran => {
                listaAlbaranesSimples.push(new AlbaranSimple(datosAlbaran))
            })

            res.setHeader('X-Total-Count', sapBody.tot_rec);
            res.status(200).json(listaAlbaranesSimples);
        } else {
            L.xe(req.txId, ["SAP no ha devuelto albaranes", sapBody])
            res.setHeader('X-Total-Count', 0);
            res.status(200).json([]);
        }
    });

}


