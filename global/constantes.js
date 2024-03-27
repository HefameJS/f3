'use strict';

const git = require('global/git');
const os = require('os');

module.exports = {
	TX_STATUS: {
		DESCONOCIDO: -1,
		RECEPCIONADO: 1010,
		ESPERANDO_INCIDENCIAS: 1020,
		INCIDENCIAS_RECIBIDAS: 1030,
		FALLO_AUTENTICACION: 3010,
		NO_AUTORIZADO: 3011,
		PETICION_INCORRECTA: 3020,
		NO_SAP: 3110,
		RECHAZADO_SAP: 3120,
		ERROR_RESPUESTA_SAP: 3130,
		MAX_RETRANSMISIONES: 8110,
		OK: 9900,
		PEDIDO: {
			ESPERANDO_NUMERO_PEDIDO: 8010,
			ESPERA_AGOTADA: 8100,
			SIN_NUMERO_PEDIDO_SAP: 9140,
		},
		DEVOLUCION: {
			PARCIAL: 29000,
			RECHAZO_TOTAL: 29100
		},
		CONFIRMACION_PEDIDO: {
			NO_ASOCIADA_A_PEDIDO: 9004,
		},
		CONSULTA: {
			ERROR_DB: 9000,
			NO_EXISTE: 9005
		},
		LOGISTICA: {
			SIN_NUMERO_LOGISTICA: 9141,
		},
		RETRANSMISION: {
			OK: 19001,
			IMPOSIBLE: 19002,
			SOLO_FORZANDO: 19003,
		}
	},
	TX_TYPES: {
		INVALIDO: 999,
		AUTENTICACION: 0,
		PEDIDO: 10,
		CONSULTA_PEDIDO: 11,
		PEDIDO_DUPLICADO: 12,
		CONFIRMACION_PEDIDO: 13,
		RETRANSMISION_PEDIDO: 14,
		ARREGLO_ESTADO: 15, // * Solo para eventos YELL
		RECUPERACION_CONFIRMACION: 16, // * Solo para eventos YELL
		DEVOLUCION: 20,
		CONSULTA_DEVOLUCION: 21,
		DEVOLUCION_DUPLICADA: 22,
		BUSCAR_ALBARANES: 30,
		CONSULTAR_ALBARAN: 31,
		CONFIRMACION_ALBARAN: 32,
		BUSCAR_FACTURAS: 40,
		CONSULTAR_FACTURA: 41,
		LOGISTICA: 50,
		CONSULTA_LOGISTICA: 51,
		LOGISTICA_DUPLICADA: 52
	},
	INCIDENCIA_FEDICOM: {
		ERR_PED: 'PED-ERR-999',
		WARN_PED: 'PED-WARN-999',
		ERR_DEV: 'DEV-ERR-999',
		WARN_DEV: 'DEV-WARN-999',
		ERR_ALB: 'ALB-ERR-999',
		WARN_ALB: 'ALB-WARN-999',
		ERR_FACT: 'FACT-ERR-999',
		WARN_FACT: 'FACT-WARN-999',
		ERR_LOG: 'LOG-ERR-999',
		WARN_LOG: 'LOG-WARN-999'
	},
	HOSTNAME: os.hostname().toLowerCase(),
	VERSION: {
		PROTOCOLO: '3.4.11',
		SERVIDOR: '0.14.3',
		TRANSMISION: 1403,
		GIT: {}
	},
	PROCESOS: {
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




