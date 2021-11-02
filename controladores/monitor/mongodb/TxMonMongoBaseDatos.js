'use strict';
const K = global.K;
const M = global.M;


const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');


class EstadisticasBaseDatos {
	constructor(d) {
		this.nomrbe = d.db;
		this.numeroColecciones = d.collections;
		this.numeroVistas = d.views;
		this.numeroDocumentos = d.objects;
		this.numeroIndices = d.indexes;
		this.bytesPorDocumento = d.avgObjSize;
		this.bytesEnDocumentos = d.storageSize;
		this.bytesEnIndices = d.indexSize;
		this.bytesTotal = d.totalSize;
		this.bytesSinComprimir = d.dataSize;
		this.bytesDiscoUsados = d.fsUsedSize;
		this.bytesDiscoMax = d.fsTotalSize;
	}
}



class TxMonMongoBaseDatos extends TransmisionLigera {

	// @Override
	async operar() {
		this.log.info('Solicitud del estado MongoDB - Base de Datos');
		try {
			let estadisticasDb = await M.db.command({ dbStats: 1 });
			estadisticasDb = new EstadisticasBaseDatos(estadisticasDb);
			return new ResultadoTransmisionLigera(200, estadisticasDb);
		} catch (errorMongo) {
			this.log.err('Error al obtener las estadísticas de la base de datos', errorMongo);
			return (new ErrorFedicom(errorMongo)).generarResultadoTransmision();
		}
	}
}


TxMonMongoBaseDatos.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonMongoBaseDatos;