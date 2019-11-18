'use strict';
const BASE = global.BASE;
const L = global.logger;
const config = global.config;

const FedicomError = require(BASE + 'model/fedicomError');


class AlbaranJSON {

    constructor(txId, albaranXML) {

        var base = albaranXML['Documento'];
        var cabecera = base['CabAlbaranes'][0]['Albaran'][0];
        var lineas = base['DetalleAlbaran'][0]['LineaAlbaran'][0]['Linea'];
        var totalAlbaran = base['DetalleAlbaran'][0]['TotalAlbaran'][0]['Total'][0];
        var impuestos = base['DetalleAlbaran'][0]['IvaAlbaran'][0]['Iva'];

        
        //this.SAPlineas = lineas;
        

        this.codigoCliente = base.Cliente[0];
        this.numeroAlbaran = cabecera.Numero[0];
        this.fechaAlbaran = cabecera.Fecha[0].replace(/\-/g, '/');
        this.numeroFactura = undefined;
        this.fechaFactura = undefined;
        this.codigoAlmacen = cabecera.Almacen[0];
        this.descripcionAlmacen = cabecera.DesAlmacen[0];
        this.reparto = cabecera.Reparto[0];
        this.operador = cabecera.Operadora[0];
        this.ruta = cabecera.Ruta[0];
        this.pedidos = [ 
            { 
                numeroPedido: undefined, 
                tipoPedido: cabecera.TipoPedido[0],
                aplazamiento: undefined,
                canal: undefined
            }
        ];
        this.lineas = AlbaranJSON_parseLines(lineas);

        this.impuestos = [];
        impuestos.forEach((impuesto) => {
            if (impuesto['Base'][0])
                this.impuestos.push(new Impuesto(impuesto));
        });

        this.totales = new TotalAlbaran(totalAlbaran, this.impuestos);
  
    }
}

const AlbaranJSON_parseLines = function( lineasXML ) {
    
    var lineas = [];

    lineasXML.forEach( (linea) => {
        if (linea['Articulo'][0])
            lineas.push(new LineaAlbaran(linea));
    });

    return lineas;
}

class LineaAlbaran {
    constructor(lineaXML) {
        this.orden = parseInt(lineaXML['NumLinea'][0]);
        this.codigoArticulo = lineaXML['Articulo'][0];
        this.descripcionArticulo = lineaXML['Descripcion'][0];
        //this.pedido = undefined;
        //this.modelo = undefined;
        //this.lotes = undefined; // Lotes = [{lote, fechaCaducidad}]
        //this.cubeta = undefined; // Cubeta = [{codigo, unidades}]
        this.cantidadPedida = parseInt(lineaXML['CantidadPed'][0]);
        this.cantidadServida = parseInt(lineaXML['CantidadServ'][0]);
        this.cantidadBonificada = parseInt(lineaXML['CantidadBon'][0]);
        if (lineaXML['PVP'][0]) this.precioPvp = parseFloat(lineaXML['PVP'][0].replace(/\,/,'.'));
        //this.precioPvf = undefined;
        //this.precioPvl = undefined;
        if (lineaXML['NETO'][0]) this.precioNeto = parseFloat(lineaXML['NETO'][0].replace(/\,/, '.'));
        if (lineaXML['PVA'][0]) this.precioAlbaran = parseFloat(lineaXML['PVA'][0].replace(/\,/, '.'));

        if (lineaXML['IVALinea'][0] !== '00') {
            this.impuesto = new ImpuestoLinea(parseInt(lineaXML['IVALinea'][0]), this.precioNeto);
        }

        if (this.precioNeto && this.precioAlbaran && this.precioNeto < this.precioAlbaran) {
            this.descuento = {
                tipo: undefined,
                descripcion: undefined,
                porcentaje: Math.floor((100 - ((this.precioNeto * 100) / this.precioAlbaran)) * 100) / 100,
                importe: Math.ceil( (this.precioAlbaran - this.precioNeto) * 100) / 100
            };
        }

        if (this.precioNeto && this.precioAlbaran && this.precioNeto > this.precioAlbaran) {
            this.cargo = {
                tipo: undefined,
                descripcion: undefined,
                porcentaje: Math.floor((((this.precioNeto * 100) / this.precioAlbaran) - 100) * 100) / 100,
                importe: Math.ceil((this.precioNeto - this.precioAlbaran) * 100) / 100
            };
        }
        
        this.cargo = undefined;
        if (lineaXML['Observaciones'][0]) this.observaciones = lineaXML['Observaciones'][0]
        //this.incidencias: undefined
    }
}

class TotalAlbaran {
    constructor(totalAlbaran, impuestos) {
        this.lineas = parseInt(totalAlbaran['Lineas'][0]);
        this.lineasServidas = undefined;
        this.lineasFalta = undefined;
        this.lineasBonificada = undefined;
        this.cantidadPedida = parseInt(totalAlbaran['UnidadesPed'][0]);
        this.cantidadServida = parseInt(totalAlbaran['UnidadesServ'][0]);
        
        this.cantidadBonificada = parseInt(totalAlbaran['UnidadesBon'][0]);
        this.precioPvp = parseFloat(totalAlbaran['TotPVP'][0].replace(/,/, '.'));
        this.precioPvf = undefined;
        this.precioPvl = undefined;
        this.precioNeto = parseFloat(totalAlbaran['TotNeto'][0].replace(/,/, '.'));;
        this.precioAlbaran = parseFloat(totalAlbaran['TotPVA'][0].replace(/,/, '.'));;
        this.impuestos = impuestos;

        /*
        this.descuentos = [];
        if (totalAlbaran['D.ESP'][0]) this.descuentos.push(new Descuento('ESP', totalAlbaran['D.ESP'][0]));
        if (totalAlbaran['D.GEN'][0]) this.descuentos.push(new Descuento('GEN', totalAlbaran['D.GEN'][0]));
        if (totalAlbaran['D.PAR'][0]) this.descuentos.push(new Descuento('PAR', totalAlbaran['D.PAR'][0]));

        this.cargos = [];
        */
    }

}

class Descuento {
    constructor(tipo, porcentaje) {
        this.tipo = tipo;
        if (tipo === 'ESP') this.descripcion = 'Descuento especialidad';
        if (tipo === 'GEN') this.descripcion = 'Descuento genéricos';
        if (tipo === 'PAR') this.descripcion = 'Descuento parafarmacia';
        this.porcentaje = parseFloat(porcentaje.replace(/\,/, '.'));
        this.importe = undefined;
    }
}

class Impuesto {
    constructor(impuesto) {
        this.tipo = Impuesto_getTipo(impuesto['IVAPorcentaje'][0]);
        this.base = parseFloat(impuesto['Base'][0].replace(/\,/, '.'));
        this.porcentaje = parseFloat(impuesto['IVAPorcentaje'][0].replace(/\,/, '.'));
        this.importe = Math.ceil( this.base * this.porcentaje ) / 100;
        this.porcentajeRecargo = parseFloat(impuesto['PorcentajeRec'][0].replace(/\,/, '.'));
        this.importeRecargo = Math.ceil(this.base * this.porcentajeRecargo) / 100;
    }
}

class ImpuestoLinea {
    constructor(porcentaje, neto) {
        this.tipo = Impuesto_getTipo(porcentaje);
        this.base = neto;
        this.porcentaje = parseFloat(porcentaje);
        this.importe = Math.ceil(this.base * this.porcentaje) / 100;
        this.porcentajeRecargo = Impuesto_getPorcentajeRecargo(porcentaje),
        this.importeRecargo = Math.ceil(this.base * this.porcentajeRecargo) / 100;
    }
}


function Impuesto_getTipo(porcentaje) {
    switch(parseInt(porcentaje)) {
        case 4: return 'IVA - SUPERREDUCIDO';
        case 10: return 'IVA - REDUCIDO';
        case 21: return 'IVA - GENERAL';
        default: return 'DESCONOCIDO';
    }
}

function Impuesto_getPorcentajeRecargo(porcentaje) {
    switch (parseInt(porcentaje)) {
        case 4: return 0.5;
        case 10: return 1.75;
        case 21: return 5.2;
        default: return 0;
    }
}


module.exports = AlbaranJSON;



