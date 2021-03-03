'use strict';

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
    SOFTWARE_ID: {
        HEFAME: '0026',
        RETRANSMISOR: '9002'
    },
    CODIGOS_ERROR_FEDICOM: { /* DEPRECAR */
        WARN_PROTOCOLO: 'PROTOCOL-WARN-999',
        WARN_NO_EXISTE_ALMACEN: 'PED-WARN-999',
        ERR_TODAS_LINEAS_ERROR: 'PED-ERR-999',
        ERR_BLOQUEO_SAP: 'PED-ERR-999',
    },
    INCIDENCIA_FEDICOM: {
        ERR_PED: 'PED-ERR-999',
        WARN_PED: 'PED-WARN-999',
		ERR_DEV: 'DEV-ERR-999',
		WARN_DEV: 'DEV-WARN-999'
    },
    MOTIVO_DEVOLUCION: {
        "01": "Caducidad del producto",
        "02": "Retirado por alerta sanitaria",
        "03": "Falta género",
        "04": "Mal estado",
        "05": "Mal servido",
        "06": "No interesa",
        "07": "Mal anotado",
        "08": "Error en el precio",
        "09": "Defecto de calidad",
        "10": "Otros"
    },
    PRE_CLEAN: {
        LOGISTICA: {
            CABECERA: {
                // Campos que al ser obligatorios se verifican en la creacion del objeto y por tanto ignoramos
                codigoCliente: { ignore: true },
                numeroLogisticaOrigen: { ignore: true },
                lineas: { ignore: true },
                login: { ignore: true },
                crc: { ignore: true },
                sapSystem: { ignore: true },
                authReq: { ignore: true },
                ignorarTodasLineas: { ignore: true },
                origen: { ignore: true },
                destino: { ignore: true },

                // Campos que son de solo salida, es decir, no deberían aparecer en las peticiones
                numeroLogistica: { remove: true },
                fechaLogistica: { remove: true },
                
                // Campos que de aparecer deben ser cadenas de texto
                tipoLogistica: { string: { max: 1 } },
                observaciones: { string: { max: 50 } },

                // Campos que deben ser array
                incidencias: { array: {} }
            },
            LINEAS: {
                // Campos que al ser obligatorios se verifican en la creacion del objeto y por tanto ignoramos
                codigoArticulo: { ignore: true },
                sap_ignore: { ignore: true },

                // Campos que son de solo salida, es decir, no deberían aparecer en las peticiones
                descripcionArticulo: { remove: true },

                // Campos que de aparecer deben ser cadenas de texto
                observaciones: { string: { max: 50 } },

                // Campos que de aparecer deben ser enteros
                orden: { integer: {} },
                cantidad: { integer: {} },

                // Campos que deben ser array
                incidencias: { array: {} }
            }
        },
    },
    POST_CLEAN: {
        LOGISTICA: {
            removeCab: ['login', 'crc', 'sap_punto_entrega', 'ignorarTodasLineas', 'sap_bloqueo_entrega', 'sap_create_logistic'],
            removePos: ['sap_pos', 'sap_ignore'],
            replaceCab: ['numeroLogistica', 'codigoCliente', 'numeroLogisticaOrigen', 'tipoLogistica', 'fechaLogistica'],
            replacePos: ['codigoArticulo', 'descripcionArticulo'],
            removeCabEmptyString: ['observaciones', 'tipoLogistica'],
            removeCabEmptyArray: ['incidencias'],
            removeCabZeroValue: [],
            removeCabIfFalse: [],
            removePosEmptyString: ['observaciones', 'descripcionArticulo'],
            removePosEmptyArray: ['incidencias'],
            removePosZeroValue: [],
            removePosIfFalse: [],
            replaceDireccionLogistica: ['codigoPostal'],
            removeDireccionLogisticaEmptyString: ['codigo', 'nombre', 'calle', 'poblacion', 'provincia', 'codigoPostal', 'pais', 'telefono', 'email']
        },
    },
    PROTOCOL_VERSION: '3.4.8',
    SERVER_VERSION: '0.13.1',
    TX_VERSION: 1203,
    LIMITE_DUPLICADOS: 7 * 24 * 60 * 60 * 1000,
    PROCESS_REGISTER_INTERVAL: 10000,
    PROCESS_STATUS: {
        ALIVE: 0,
        MISSING: 10,
        DEAD: 99
    },
    TIPIFICADO_FALTAS: {
        "BAJA": "desconocido",
        "BAJA HEFAME": "desconocido",
        "DESCONOCIDO": "desconocido",
        "RECHAZADO CLIENTE": "desconocido",
        "POR ENCARGO": "noPermitido",
        "POR OPERADOR/WEB": "noPermitido",
        "NO PERMITIDO EN TIPO DE PEDIDO": "noPermitido",
        "ESTUPEFACIENTE": "estupe",
        "NUMERO VALE INCORRECTO": "estupe",
        "ENTREGA BLOQUEADA PARA O.T.": "stock",
        "NO HAY EXISTENCIAS": "stock",
        "PASADO A OTRO ALMACÉN": "stock",
        "RETRASO TRATAMIENTO ENTRADAS": "stock",
        "SERVICIO CENTRALIZADO": "stock",
        "SIN EXISTENCIAS": "stock",
        "UBICACIÓN PICKING VACÍA": "stock",
        "EXCESO UNIDADES POR LINEA": "suministro",
        "FALTA DE SUMINISTRO": "suministro",
        "LIMITE EXISTENCIAS": "suministro",
        "RETRASO SERVICIO": "suministro",
        "SERVICIO PARCIAL": "suministro",
        "SIN UNIDADES PTES": "suministro"
    },
	VERSION: {
		PROTOCOLO: '3.4.8',
		SERVIDOR: '0.13.1',
		TRANSMISION: 1203,
	},
	PROCESOS: {
		TITULOS: {
			MASTER: 'f3-master',
			WORKER: 'f3-worker',
			WATCHDOG: 'f3-watchdog',
			MONITOR: 'f3-monitor'
		},
		TIPOS: {
			MASTER: 'master',
			WORKER: 'worker',
			WATCHDOG: 'watchdog',
			MONITOR: 'monitor',
			BALANCEADOR: 'balanceador'
		},
	}
}




