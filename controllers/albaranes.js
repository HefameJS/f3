'use strict';
const BASE = global.BASE;
const L = global.logger;
const config = global.config;


const FedicomError = require(BASE + 'model/fedicomError');
const Tokens = require(BASE + 'util/tokens');
const Isap = require(BASE + 'interfaces/isap');
const AlbaranJSON = require(BASE + 'model/albaranJSON');
// const albaran = require(BASE + 'model/albaran')


exports.getAlbaran = function (req, res) {

    L.xi(req.txId, ['Procesando transmisión como CONSULTA DE ALBARAN']);

    req.token = Tokens.verifyJWT(req.token, req.txId);
    if (req.token.meta.exception) {
        L.xe(req.txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
        req.token.meta.exception.send(res);
        return;
    }

    var clienteSap = req.token.sub;
    if (clienteSap && clienteSap.endsWith('@hefame')) {
        clienteSap = clienteSap.substring(0, clienteSap.length - 7).padStart(10, '0')
    }

    L.xi(req.txId, ['El token transmitido resultó VALIDO y se obtuvo el clienteSAP', req.token, clienteSap], 'txToken');

    var numAlbaran = req.params.numeroAlbaran;
    if (!numAlbaran) {
        var fedicomError = new FedicomError('ALB-ERR-003', 'El parámetro "numeroAlbaran" es obligatorio', 400);
        fedicomError.send(res);
        return;
    }

    var numAlbaranSaneado = numAlbaran.padStart(10, '0');
    L.xi(req.txId, ['El número de albarán solicitado', numAlbaran, numAlbaranSaneado])

    var formatoAlbaran = 'JSON';

    if (req.headers['content-type']) {
        switch (req.headers['content-type'].toLowerCase()){
            case 'application/pdf': formatoAlbaran = 'PDF'; break;
            default: formatoAlbaran = 'JSON'; break;
        }
    }

    switch (formatoAlbaran) {
        case 'JSON':
            return getAlbaranJSON(req, res, numAlbaranSaneado, clienteSap);
        case 'PDF':
            return getAlbaranPDF(req, res, numAlbaranSaneado);
        default:
            var fedicomError = new FedicomError('ALB-ERR-999', 'No se reconoce del formato de albarán en la cabecera "Content-Type"', 400);
            fedicomError.send(res);
            return;
    }


        

}

/**
 * Obtención de un único albarán.
 * Se espera que req.params.numeroAlbaran venga.
 */
const getAlbaranJSON = function (req, res, numAlbaranSaneado, clienteSap, returnAsArray) {

    Isap.getAlbaranXML(req.txId, numAlbaranSaneado, clienteSap, (err, sapRes, soapBody) => {
        if (err) {
            L.xe(req.txId, ['Ocurrió un error al solicitar el albarán XML', err]);
            var fedicomError = new FedicomError('ALB-ERR-999', 'Ocurrió un error al buscar el albarán', 500);
            fedicomError.send(res);
            return;
        }

        // L.xd(req.txId, ['Se obtuvo el siguiente albarán XML', soapBody]);

        var parseString = require('xml2js').parseString;
        parseString(soapBody, (err, soapResult) => {
            if (err) {
                L.xe(req.txId, ['Ocurrió un error al analizar la respuesta del albarán XML', err]);
                var fedicomError = new FedicomError('ALB-ERR-999', 'Ocurrió un error al buscar el albarán', 500);
                fedicomError.send(err);
                return;
            }

            soapResult = soapResult['env:Envelope']['env:Body'][0]['n0:YTC_ALBARAN_XML_HEFAMEResponse'][0];
            var status = soapResult['O_STATUS'][0];

            L.xd(req.txId, ['Se obtuvo el código O_STATUS', status])
            
            if (status !== '00') {
                L.xe(req.txId, ['Se obtuvo el código O_STATUS distinto de "00". No se consigue recuperar el albarán de SAP', status])
                var fedicomError = new FedicomError('ALB-ERR-001', 'El albarán solicitado no existe', 404);
                fedicomError.send(res);
                return;
            } else {
                var albaranXML = '';
                soapResult['TO_EDATA'][0]['item'].forEach( (linea) => {
                    albaranXML += linea['ELINEA'][0];
                });
                L.xd(req.txId, ['Se obtuvo el siguiente albarán XML', {albaranXML}]);

                parseString(albaranXML, (err, albaranJSONpre) => {
                    if (err) {
                        L.xe(req.txId, ['Ocurrió un error al analizar la respuesta del albarán XML', err]);
                        var fedicomError = new FedicomError('ALB-ERR-999', 'Ocurrió un error al buscar el albarán', 500);
                        fedicomError.send(err);
                        return;
                    }

                    L.xi(req.txId, ['Se procede a crear el Albaran JSON']);

                    var albaranJSON = new AlbaranJSON(req.txId, albaranJSONpre)
                    if (returnAsArray) albaranJSON = [albaranJSON];
                    res.send(albaranJSON);
                    L.xi(req.txId, ['Se envía albarán al cliente', albaranJSON]);
                    
                });
            }

 
        });

    });
}

const getAlbaranPDF = function (req, res, numAlbaranSaneado) {
    Isap.getAlbaranPDF(req.txId, numAlbaranSaneado, (err, sapRes, soapBody) => {
        if (err) {
            console.log(err);
            L.xe(req.txId, ['Ocurrió un error al solicitar el albarán PDF', err]);
            var fedicomError = new FedicomError('ALB-ERR-999', 'Ocurrió un error al buscar el albarán', 500);
            fedicomError.send(res);
            return;
        }

         
        
        if (soapBody && soapBody[0] && soapBody[0].pdf_file) {
            L.xi(req.txId, ['Se obtuvo el albarán PDF en Base64 desde SAP']);
            var buffer = Buffer.from(soapBody[0].pdf_file, 'base64');
            //res.setHeader('Content-Length', buffer.length);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=' + numAlbaranSaneado + '.pdf');
            res.status(200);
            res.send(buffer);
        }
        else {
            L.xe(req.txId, ['Ocurrió un error al solicitar el albarán PDF', err]);
            var fedicomError = new FedicomError('ALB-ERR-999', 'Ocurrió un error al buscar el albarán', 500);
            fedicomError.send(res);
        }
        
    });
}


exports.findAlbaran = function (req, res) {

    L.xi(req.txId, ['Procesando transmisión como BÚSQUEDA DE ALBARAN']);

    if (!req.query.codigoCliente) {
        var error = new FedicomError('ALB-ERR-002', 'El "codigoCliente" es inválido.', 400);
        error.send(res);
        return;
    }

    var codigoCliente = req.query.codigoCliente.padStart(10, '0');

    // En el caso (absurdo) de que se busque por un numeroAlbaran concreto,
    // hacemos la búsqueda de ese albaran concreto
    if (req.query.numeroAlbaran) {
        var numAlbaran = req.query.numeroAlbaran.padStart(10, '0');
        return getAlbaranJSON(req, res, numAlbaran, codigoCliente, true /*Responder en un array*/);
    }


    var limit = parseInt(req.query.limit) || 50;
    if (limit > 50 || limit <= 0) {
        var error = new FedicomError('ALB-ERR-008', 'El "limit" es inválido', 400);
        error.send(res);
        return;
    }

    var offset = parseInt(req.query.offset) || 0;
    if (offset < 0) {
        var error = new FedicomError('ALB-ERR-007', 'El "offset" es inválido', 400);
        error.send(res);
        return;
    }

    var sapQueryString = {
        customer: codigoCliente
    }

    // Limpieza de Fechas.
    // Si viene fechaAlbaran, esta manda.
    // De lo contrario, se usa fechaDesde/fechaHasta. Si alguno no aparece, se establece a la fecha actual.
    var fA = req.query.fechaAlbaran ? Date.fromFedicomDate(req.query.fechaAlbaran) : null;
    if (fA) {
        sapQueryString.date_ini = sapQueryString.date_end = Date.toSapDate(fA);
    } else {
        sapQueryString.date_ini = Date.toSapDate(Date.fromFedicomDate(req.query.fechaDesde));
        sapQueryString.date_end = Date.toSapDate(Date.fromFedicomDate(req.query.fechaHasta));

        // TODO: Comprobar que el rango no es 
    }

    L.xd(req.txId, ['Buscando en SAP albaranes con filtro', sapQueryString]);

    Isap.findAlbaranes(req.txId, sapQueryString, (err, sapRes, sapBody) => {
        if (err) {
            L.xe(req.txId, ['Ocurrió un error al buscar albaranes', err]);
            var error = new FedicomError('ALB-ERR-999', 'Ocurrió un error en la búsqueda de albaranes', 500);
            error.send(res);
            return;
        }

        if (sapBody && sapBody.forEach) {
            if (sapBody[0].id)  {
                L.xe(req.txId, ['SAP indicó un error de precondición', sapBody[0].id, sapBody[0].message]);
                var errCode = (sapBody[0].id === 4) ? 'ALB-ERR-009' : 'ALB-ERR-999';
                var error = new FedicomError(errCode, sapBody[0].message, 500);
                error.send(res);
                return;
            }
            
            L.xd(req.txId, ['SAP retornó un total de ' + sapBody.length + ' albaranes']);
            var listaAlbaranes = [];
            sapBody.forEach( (albaran) => {
                
                if (albaran.oproforma && albaran.order_dec === 'Cargo' && albaran.stats_now !== 'Registrado') {
                    if (--offset < 0 && limit-- > 0) {
                        listaAlbaranes.push({
                            numeroAlbaran: albaran.oproforma,
                            fechaAlbaran: Date.fromSAPtoFedicomDate( albaran.prof_date ),
                            totales: { 
                                precioAlbaran: albaran.amount_or,
                                precioNeto: albaran.amount_ne
                            },
                            observaciones: albaran.stats_now
                        });
                    }
                }

                

            });
            L.xi(req.txId, ['Se le envían al cliente ' + listaAlbaranes.length + ' albaranes']);
            res.setHeader('X-Total-Count', listaAlbaranes.length);
            res.status(200).json(listaAlbaranes);
        } else {
            L.xi(req.txId, ['SAP no retornó albaranes, se devuelve lista vacía']);
            res.setHeader('X-Total-Count', 0);
            res.status(200).json([]);
        }
        
    });

}
