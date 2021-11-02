'use strict';
const K = global.K;
const M = global.M;


const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');


const estadoDeNodo = (codigoEstado) => {
	switch (codigoEstado) {
		case 0: return { code: 0, name: 'INICIANDO', desc: 'La instancia está iniciandose' }
		case 1: return { code: 1, name: 'PRIMARIA', desc: 'Copia primaria de la base de datos' }
		case 2: return { code: 2, name: 'SECUNDARIA', desc: 'Instancia replicando datos' }
		case 4: return { code: 4, name: 'SINCRONIZANDO', desc: 'La instancia se está sincronizando' }
		case 5: return { code: 5, name: 'UNIENDOSE', desc: 'La instancia se está uniendo al clúster' }
		case 7: return { code: 7, name: 'ARBITRO', desc: 'Instancia sin datos para tiebreak' }
		case 8: return { code: 8, name: 'DOWN', desc: 'La instancia no es accesible' }
		case 9: return { code: 9, name: 'ROLLBACK', desc: 'Recuperandose tras un failover' }
		case 10: return { code: 10, name: 'ELIMINADA', desc: 'Ya no forma parde del clúster' }
		default: return { code: codigoEstado, name: 'DESCONOCIDO', desc: `No se conoce el estado '${codigoEstado}'` };
	}
}


class EstadoReplicaSet {
	nombre;
	hora;
	intervaloHeartBeat;
	miembros;

	constructor(data) {
		if (!data) throw { ok: false, msg: 'No hay datos del ReplicaSet' };
		this.nombre = data.set;
		this.hora = data.date;
		this.intervaloHeartBeat = data.heartbeatIntervalMillis;
		this.miembros = data.members.map(m => new MiembroReplicaSet(m));
	}
}

class MiembroReplicaSet {
	constructor(data) {
		this.id = data.id;
		this.activo = Boolean(data.health);
		this.estado = estadoDeNodo(data.state);
		this.servidor = data.name;
		this.uptime = data.uptime;
		this.version = data.configVersion;

		if (data.state === 1) { // Si es nodo PRIMARIO
			this.fechaEleccion = data.electionDate;
		} else {
			this.sincronizandoCon = data.syncSourceHost;
			this.ping = data.pingMs;
			this.ultimaOperacion = (new Date()).getTime() - data.optimeDate;
		}
	}
}



/**
 * Transmision que devuelve un token de observador
 */
class TxMonMongoReplicaSet extends TransmisionLigera {

	// @Override
	async operar() {
		this.log.info('Solicitud del estado MongoDB - ReplicaSet');
		try {
			let adminDB = M.getBD('admin');
			let datosReplicaSet = await adminDB.command({ "replSetGetStatus": 1 })
			let estadoReplicaSet = new EstadoReplicaSet(datosReplicaSet);

			return new ResultadoTransmisionLigera(200, estadoReplicaSet);
		} catch (errorMongo) {
			this.log.err('Error al obtener el estado del clúster', errorMongo);
			return (new ErrorFedicom(errorMongo)).generarResultadoTransmision();
		}
	}
}


TxMonMongoReplicaSet.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonMongoReplicaSet;