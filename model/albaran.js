'use strict';
const BASE = global.BASE;
const L = global.logger;
const config = global.config;

const FedicomError = require(BASE + 'model/fedicomError');
const Isap = require(BASE + 'interfaces/isap');





class Albaran {

    constructor(txId, cab, pos) {
        //this.cab = cab;
        //this.pos = pos;


        this.codigoCliente = cab.cust_code;
        this.numeroAlbaran = cab.oproforma;
        this.fechaAlbaran = Date.fromSAPtoFedicomDate(cab.prof_date);
        this.numeroFactura = undefined;
        this.fechaFactura = undefined;
        this.codigoAlmacen = cab.warehouse_p;
        this.descripcionAlmacen = cab.warehouse_p_name;
        this.reparto = cab.order_del;
        this.operador = undefined;
        this.ruta = undefined;
        
        this.pedidos = [ 
            { 
                numeroPedido: cab.order,     // TODO: Convertir a pedido Fedicom desde cab.order_ref <- CRC
                tipoPedido: undefined,
                aplazamiento: undefined,
                canal: undefined
            }
        ];

        var totales = new TotalAlbaran();
        

        // Hacer magia con lineas
        var [lineas, totales] = parseLines(pos);

        this.lineas = lineas;
        this.totales = totales.toJson();
        this.impuestos = totales.impuestos.toJson();

    }


}

function parseLines(pos) {
    if (!pos || !pos.forEach) return [[], new TotalAlbaran() ];

    var lineas = [];
    var totales = new TotalAlbaran();

    pos.forEach( (pos) => {
        var newLine = {
            orden: pos.pospr,
            codigoArticulo: pos.bismt || pos.matnr,
            descripcionArticulo: pos.maktx,
            pedido: { numeroPedido: pos.order},
            modelo: undefined,
            lotes: [], // Lote = {lote, fechaCaducidad}
            cubeta: [], // Cubeta = {codigo, unidades}
            cantidadPedida: pos.unipe,
            cantidadServida: pos.unise,
            cantidadBonificada: undefined,
            precioPvp: undefined,
            precioPvf: undefined,
            precioPvl: undefined,
            precioNeto: pos.netpr,
            precioAlbaran: pos.netpr,
            impuesto: new Impuesto(pos.netpr, pos.tax),
            descuento: undefined,
            cargo: undefined,
            observaciones: undefined,
            incidencias: undefined
        }

        lineas.push(newLine);
        totales.add(pos.unipe, pos.unise, 0, pos.netpr, pos.tax);
    });

    return [lineas, totales];

    

}



class TotalAlbaran {
    constructor() {
        this.lineas = 0;
        this.lineasServidas = 0;
        this.lineasFalta = 0;
        this.lineasBonificada = 0;
        this.cantidadPedida = 0;
        this.cantidadServida = 0;
        this.cantidadFalta = 0;
        this.cantidadBonificada = 0;
        this.precioPvp = undefined;
        this.precioPvf = undefined;
        this.precioPvl = undefined;
        this.precioNeto = 0.0;
        this.precioAlbaran = 0.0;
        this.impuestos = new Impuestos();
        this.descuentos = [];
        this.cargos = [];
    }

    add(pedido, servido, bonificado, precioNeto, porcentajeImpuesto) {
        this.lineas ++;
        if (servido > 0) this.lineasServidas++;
        if (pedido != servido) this.lineasFalta++;
        if (bonificado) this.lineasBonificada++;

        this.cantidadPedida += pedido;
        this.cantidadServida += servido;
        this.cantidadFalta += (pedido-servido);
        this.cantidadBonificada += bonificado;
        this.precioNeto += precioNeto;
        this.precioAlbaran += precioNeto;
        
        this.impuestos.add( new Impuesto(precioNeto, porcentajeImpuesto) );

    }

    toJson() {
        var json = {};
        Object.assign(json, this);
        json.impuestos = json.impuestos.toJson();
        return json;
    }
}



class Impuesto {

    constructor(neto, porcentaje) {
        this.tipo = getNombreImpuesto(porcentaje);
        this.base = neto / (porcentaje/100 + 1);
        this.porcentaje = porcentaje;
        this.importe = this.base * (porcentaje/100);
        this.porcentajeRecargo = undefined;
        this.importeRecargo = undefined;
    }

    add(neto) {
        this.base += neto / (this.porcentaje / 100 + 1);
        this.importe = this.base * (this.porcentaje / 100);
    }

    toJson() {
        return this;
    }

}

class Impuestos {
    constructor() {
        this.impuestos = {};
    }

    add(impuesto) {
        if (!impuesto) return;

        var acum = this.impuestos[impuesto.porcentaje];
        if (acum) {
            acum.add(impuesto.base);
        } else {
            this.impuestos[impuesto.porcentaje] = impuesto;
        }
    }

    toJson() {
        var result = [];
        for(var impuesto in this.impuestos) {
            result.push(this.impuestos[impuesto]);
        }
        return result;
    }

}

function getNombreImpuesto(porcentaje) {
    switch(porcentaje) {
        case 4: return 'IVA - SUPERREDUCIDO';
        case 10: return 'IVA - REDUCIDO';
        case 21: return 'IVA - GENERAL';
        default: return 'IVA - DESCONOCIDO';
    }
}



module.exports = function (txId, numProforma, callback) {

    Isap.getCabeceraAlbaran(txId, numProforma, (err, sapRes, body) => {
        if (err) {
            console.log('ERROR LLAMADA SAP CABECERA', err);
            return callback(err, null);
        }

        if (!body || !body.forEach || !body.length) {
            console.log('ERROR LLAMADA SAP CABECERA - BODY', !body , !body.forEach, !body.length);
            return callback({error: 'body'}, null);
        }

        var datosCabeceraSAP = null;
        body.forEach( (order) => {
            if (order && order.oproforma === numProforma) {
                datosCabeceraSAP = order;
            }
        });

        if (datosCabeceraSAP && datosCabeceraSAP.order) {
            Isap.getPosicionesAlbaran(txId, datosCabeceraSAP.order, (err, sapRes, posBody) => {
                if (err) {
                    console.log('ERROR LLAMADA SAP POSICIONES', err);
                    return callback(err, null);
                }

                if (!posBody || !posBody.forEach || !posBody.length) {
                    console.log('ERROR LLAMADA SAP POSICIONES - BODY', !posBody, !posBody.forEach, !posBody.length);
                    return callback({ error: 'posBody' }, null);
                }

                var datosPosicionesSAP = null;
                posBody.forEach((order) => {
                    if (order && order.oproforma === numProforma) {
                        datosPosicionesSAP = order;
                    }
                });

                if (datosPosicionesSAP && datosPosicionesSAP.t_pos && datosPosicionesSAP.t_pos.forEach) {
                    callback(null, new Albaran(txId, datosCabeceraSAP, datosPosicionesSAP.t_pos));
                } else {
                    callback({ error: 'no posiciones' }, null);
                }

            });
        } else {
            callback({error: 'no existe'}, null);
        }

    });




};


