'use strict';
const BASE = global.BASE;
const L = global.logger;
const config = global.config;


//const Events = require(BASE + 'interfaces/events');
const FedicomError = require(BASE + 'model/fedicomError');
const controllerHelper = require(BASE + 'util/controllerHelper');
const Isap = require(BASE + 'interfaces/isap');


const albaran = require(BASE + 'model/albaran')



exports.getAlbaran = function (req, res) {

    var numAlbaran = req.params.numeroAlbaran;
    if (!numAlbaran) {
        res.status(400).json({ ok: 'no num' });
        return;
    }

    //0140095125 - Transfer
    //0140108230 - Normalico
    Isap.getAlbaranXML(req.txId, numAlbaran, '0010104999', (err, sapRes, soapBody) => {
        if (err) {
            console.log('ERROR', err);
            res.status(400).send(err);
            return;
        }

        var parseString = require('xml2js').parseString;
        parseString(soapBody, (err, soapResult) => {
            if (err) {
                return res.status(500).send({err: err});
            }

            soapResult = soapResult['env:Envelope']['env:Body'][0]['n0:YTC_ALBARAN_XML_HEFAMEResponse'][0];
            var status = soapResult['O_STATUS'][0];
            

            if (status !== '00') {
                res.status(404).send({ err: 'No hay albaran', status: status });
            } else {
                var albaranXML = '';
                soapResult['TO_EDATA'][0]['item'].forEach( (linea) => {
                    albaranXML += linea['ELINEA'][0];
                })

                parseString(albaranXML, (err, albaranJSONpre) => {
                    if (err) {
                        return res.status(500).send({ err: err });
                    }

                    var AlbaranJSON = require(BASE + 'model/albaranJSON');
                    var albaranJSON = new AlbaranJSON(req.txId, albaranJSONpre)
                    res.send(albaranJSON);
                });
            }

 
        });

    });

/*

    albaran(req.txId, numAlbaran, function(err, albaran) {
        if (err) {
            console.log(err);
            res.status(500).json({ ok: err });
            return;
        }

        res.status(200).json(albaran);
    });
*/
}




exports.findAlbaran = function (req, res) {

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
        albaran(req.txId, numAlbaran, function (err, albaran) {
            if (err) {
                console.log(err);
                res.status(200).json([]);
                return;
            }

            // Si no coincide el codigoCliente no lo devolvemos
            if (albaran.codigoCliente === codigoCliente) {
                res.status(200).json([albaran]);
            } else {
                res.status(200).json([]);
            }
        });
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
    }

    Isap.findAlbaranes(req.txId, sapQueryString, (err, sapRes, sapBody) => {
        if (err) {
            console.log(err);
            res.status(500).json({ ok: err });
            return;
        }

        if (sapBody && sapBody.forEach) {
            console.log(sapBody);
            var listaAlbaranes = [];
            sapBody.forEach( (albaran) => {
                if (albaran.oproforma) {
                    listaAlbaranes.push({
                        numeroAlbaran: albaran.oproforma,
                        fechaAlbaran: Date.fromSAPtoFedicomDate( albaran.prof_date ),
                        totales: { precioAlbaran: albaran.amount_or }
                    });
                }
            });
            res.status(200).json(listaAlbaranes);
        } else {
            res.status(200).json([]);
        }
        
    });

}
