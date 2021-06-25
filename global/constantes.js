'use strict';

const os = require('os');

module.exports = async function () {

	global.K.ESTADOS = {
		ERROR_GENERICO: 1000,
		RECEPCIONADO: 1010,
		PETICION_ENVIADA_A_SAP: 1020,
		OBTENIDA_RESPUESTA_DE_SAP: 1030,
		FALLO_AUTENTICACION: 3010,
		FALLO_AUTORIZACION: 3011,
		DUPLICADO: 3012,
		PETICION_INCORRECTA: 3020,
		ERROR_RESPUESTA_SAP: 3130,
		COMPLETADO: 9900,
		PEDIDO: {
			RECHAZADO_SAP: 3120,
			NO_SAP: 3110,
			ESPERANDO_NUMERO_PEDIDO: 8010,
			SIN_NUMERO_PEDIDO_SAP: 9140
		},
		CONFIRMAR_PEDIDO: {
			NO_ASOCIADA_A_PEDIDO: 9004,
		},
		CONSULTA: {
			ERROR: 9000,
			NO_EXISTE: 9005
		},
		DEVOLUCION: {
			PARCIAL: 29000,
			RECHAZADA: 29100
		},
		LOGISTICA: {
			RECHAZADO_SAP: 3120,
			SIN_NUMERO_LOGISTICA: 9141
		}
	};
	global.K.TIPOS = {
		PLANTILLA: -1,
		RECHAZO: 100,
		AUTENTICACION: 0,
		CREAR_PEDIDO: 10,
		CONSULTAR_PEDIDO: 11,
		CONFIRMAR_PEDIDO: 13,
		CREAR_DEVOLUCION: 20,
		CONSULTAR_DEVOLUCION: 21,
		BUSCAR_ALBARANES: 30,
		CONSULTAR_ALBARAN: 31,
		CONFIRMAR_ALBARAN: 32,
		BUSCAR_FACTURAS: 40,
		CONSULTAR_FACTURA: 41,
		CREAR_LOGISTICA: 50,
		CONSULTAR_LOGISTICA: 51
	};
	global.K.HOSTNAME = os.hostname().toLowerCase();
	global.K.VERSION = {
		PROTOCOLO: '3.4.11',
		SERVIDOR: '2.0.0',
		TRANSMISION: 20000,
		GIT: await require('global/git').obtenerCommitHash()
	};
	global.K.SOFTWARE_ID = {
		SERVIDOR: '0026',
		RETRANSMISOR: '9002'
	};
	global.K.PROCESOS = {
		getTitulo: function (tipo) {
			switch (tipo) {
				case 'master': return 'f3-master';
				case 'worker': return 'f3-worker';
				case 'watchdogPedidos': return 'f3-w-pedidos';
				case 'watchdogSqlite': return 'f3-w-sqlite';
				case 'monitor': return 'f3-monitor';
				default: return 'indefinido';
			}
		},
		TIPOS: {
			MASTER: 'master',
			WORKER: 'worker',
			WATCHDOG_PEDIDOS: 'watchdogPedidos',
			WATCHDOG_SQLITE: 'watchdogSqlite',
			MONITOR: 'monitor'
		}
	}
}





