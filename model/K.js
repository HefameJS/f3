'use strict';


module.exports = {
    ISAP: {
        ERROR_TYPE_NO_SAPSYSTEM: 1,
        ERROR_TYPE_SAP_HTTP_ERROR: 2,
        ERROR_TYPE_SAP_UNREACHABLE: 3,
        errorToString(error) {
            switch (error) {
                case module.exports.ISAP.ERROR_TYPE_NO_SAPSYSTEM: return 'NO SAP SYSTEM';
                case module.exports.ISAP.ERROR_TYPE_SAP_HTTP_ERROR: return 'SAP HTTP ERROR';
                case module.exports.ISAP.ERROR_TYPE_SAP_UNREACHABLE: return 'SAP UNREACHABLE';
            }
        }
    },
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
        OK: 9900,
        PEDIDO: {
            ESPERANDO_NUMERO_PEDIDO: 8010,
            ESPERA_AGOTADA: 8100,
            SIN_NUMERO_PEDIDO_SAP: 9140,
        },
        DEVOLUCION: {
            PARCIAL: 29000
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
        BUSCAR_FACTURAS: 40,
        CONSULTAR_FACTURA: 41
    },
    SOFTWARE_ID: {
        FARMABRAIN: '0010',
        UNYCOPWIN: '0012',
        HEFAME: '0026',
        FARMALOG: '0028',
        NOVOPHAR: '0036',
        CONSOFT: '0038',
        PULSO: '0048',
        TEDIFARMA: '0059',
        TEDIFARMA_2: '0061',
        POSTMAN: '9000',
        FEDICOM_APP: '9001',
        RETRANSMISOR: '9002',
        APP_EMPLEADO: '9700',
        FMASONLINE: '9800',
        SAP_P01: '9993',
        SAP_T01: '9992',
        SAP_D01: '9991',
        FEDICOM3_APP: '9999'
    },
    CODIGOS_ERROR_FEDICOM: {
        WARN_PROTOCOLO: 'PROTOCOL-WARN-999',
        WARN_NO_EXISTE_ALMACEN: 'PED-WARN-999',
        ERR_TODAS_LINEAS_ERROR: 'PED-ERR-999',
        ERR_BLOQUEO_SAP: 'PED-ERR-999'
    },
    PRE_CLEAN: {
        PEDIDOS: {
            CABECERA: {
                // Campos que al ser obligatorios se verifican en la creacion del objeto y por tanto ignoramos
                codigoCliente: { ignore: true },
                numeroPedidoOrigen: { ignore: true },
                lineas: { ignore: true },
                login: { ignore: true },
                crc: { ignore: true },
                sap_url_confirmacion: { ignore: true },
                sapSystem: { ignore: true },
                authReq: { ignore: true },

                // Campos que son de solo salida, es decir, no deberían aparecer en las peticiones
                numeroPedido: { remove: true },
                alertas: { remove: true },
                empresaFacturadora: { remove: true },
                fechaPedido: { remove: true },

                // Campos que de aparecer deben ser cadenas de texto
                direccionEnvio: { string: { max: 50 } },
                tipoPedido: { string: { max: 6 } },
                observaciones: { string: { max: 50 } },
                codigoAlmacenServicio: { string: { max: 4 } },

                // Campos que de aparecer deben ser enteros
                aplazamiento: { integer: { min: 1 } },

                // Campos que de aparecer deben estar en formato DateTime
                fechaServicio: { datetime: {} },

                // Campos que deben ser objetos
                notificaciones: { object: true },

                // Campos que deben ser array
                incidencias: { array: {} }
            },
            LINEAS: {
                // Campos que al ser obligatorios se verifican en la creacion del objeto y por tanto ignoramos

                codigoArticulo: { ignore: true },

                sap_ignore: { ignore: true },


                // Campos que son de solo salida, es decir, no deberían aparecer en las peticiones
                descripcionArticulo: { remove: true },
                codigoArticuloSustituyente: { remove: true },
                cantidadFalta: { remove: true },
                cantidadBonificacionFalta: { remove: true },
                precio: { remove: true },
                descuentoImporte: { remove: true },
                cargoPorcentaje: { remove: true },
                cargoImporte: { remove: true },
                codigoAlmacenServicio: { remove: true },
                estadoServicio: { remove: true },
                servicioAplazado: { remove: true },

                // Campos que de aparecer deben ser cadenas de texto
                codigoArticulo: { string: { max: 15 } },
                codigoUbicacion: { string: { max: 50 } },
                valeEstupefaciente: { string: { max: 50 } },
                observaciones: { string: { max: 50 } },

                // Campos que de aparecer deben ser enteros
                orden: { integer: {} },
                cantidad: { integer: {} },
                cantidadBonificacion: { integer: { min: 1 } },
                descuentoPorcentaje: { decimal: { min: 0.01, max: 99.99 } },

                // Campos que de aparecer deben estar en formato DateTime
                fechaLimiteServicio: { datetime: {} },

                // Campos que deben ser objetos
                condicion: { object: {} },

                // Campos que deben ser booleanos
                servicioDemorado: { boolean: {} },

                // Campos que deben ser array
                incidencias: { array: {} }

            }
        },
        DEVOLUCIONES: {
            CABECERA: {
                // Campos que al ser obligatorios se verifican en la creacion del objeto y por tanto ignoramos
                codigoCliente: { ignore: true },
                lineas: { ignore: true },
                login: { ignore: true },
                crc: { ignore: true },
                sapSystem: { ignore: true },
                authReq: { ignore: true },
                lineasExcluidas: {ignore: true},

                // Campos que son de solo salida, es decir, no deberían aparecer en las peticiones
                numeroDevolucion: { remove: true },
                fechaDevolucion: { remove: true },
                codigoRecogida: { remove: true },
                numeroAlbaranAbono: { remove: true },
                fechaAlbaranAbono: { remove: true },
                empresaFacturadora: { remove: true },

                // Campos que de aparecer deben ser cadenas de texto
                observaciones: { string: { max: 50 } },

                // Campos que deben ser array
                incidencias: { array: {} }
            },
            LINEAS: {
                // Campos que al ser obligatorios se verifican en la creacion del objeto y por tanto ignoramos
                codigoArticulo: { ignore: true },
                sap_ignore: { ignore: true },
                crc: { ignore: true },


                // Campos que son de solo salida, es decir, no deberían aparecer en las peticiones
                descripcionArticulo: { remove: true },
                descripcionMotivo: { remove: true },

                // Campos que de aparecer deben ser cadenas de texto
                numeroAlbaran: { string: { max: 50 } },
                codigoArticulo: { string: { max: 15 } },
                lote: { string: { max: 15 } },
                codigoMotivo: { string: { max: 15 } },
                valeEstupefaciente: { string: { max: 50 } },
                observaciones: { string: { max: 50 } },


                // Campos que de aparecer deben ser enteros
                orden: { integer: {} },
                cantidad: { integer: {} },

                // Campos que de aparecer deben estar en formato Date
                fechaAlbaran: { date: {} },
                fechaCaducidad: { date: {} },

                // Campos que deben ser array
                incidencias: { array: {} }
            }
        }
    },
    POST_CLEAN: {
        PEDIDOS: {
            removeCab: ['login', 'crc', 'sap_pedidosasociados', 'sap_url_confirmacion', 'sap_pedidoprocesado', 'sap_tipopedido', 'sap_motivo_pedido', 'sap_cliente', 'sap_punto_entrega'],
            removePos: ['posicion_sap', 'valeestupefacientes', 'sap_ignore'],
            replaceCab: ['numeroPedido', 'codigoCliente', 'direccionEnvio', 'numeroPedidoOrigen', 'tipoPedido', 'codigoAlmacenServicio', 'fechaPedido', 'fechaServicio', 'cargoCooperativo', 'empresaFacturadora'],
            replacePos: ['codigoArticulo', 'codigoUbicacion', 'codigoArticuloSustituyente', 'cantidadFalta', 'cantidadBonificacion', 'cantidadBonificacionFalta', 'descuentoPorcentaje', 'descuentoImporte', 'cargoPorcentaje', 'cargoImporte', 'valeEstupefaciente', 'fechaLimiteServicio', 'servicioDemorado', 'estadoServicio', 'servicioAplazado', 'descripcionArticulo', 'codigoAlmacenServicio'],
            removeCabEmptyString: ['condicion', 'observaciones', 'direccionEnvio', 'empresaFacturadora', 'tipoPedido', 'fechaServicio'],
            removeCabEmptyArray: ['notificaciones', 'incidencias', 'alertas'],
            removeCabZeroValue: ['aplazamiento'],
            removeCabIfFalse: ['cargoCooperativo'],
            removePosEmptyString: ['codigoUbicacion', 'codigoArticuloSustituyente', 'valeEstupefaciente', 'fechaLimiteServicio', 'estadoServicio', 'servicioAplazado', 'observaciones'],
            removePosEmptyArray: ['notificaciones', 'incidencias', 'alertas'],
            removePosZeroValue: ['cantidadFalta', 'cantidadBonificacion', 'cantidadBonificacionFalta', 'descuentoPorcentaje', 'descuentoImporte', 'cargoPorcentaje', 'cargoImporte', 'precio'],
            removePosIfFalse: ['servicioDemorado']
        },
        DEVOLUCIONES: {
            removeCab: ['login', 'crc'],
            removePos: ['sap_ignore'],
            replaceCab: ['numeroDevolucion', 'fechaDevolucion', 'codigoRecogida', 'codigoCliente', 'numeroAlbaranAbono', 'fechaAlbaranAbono', 'empresaFacturadora'],
            replacePos: ['numeroAlbaran', 'fechaAlbaran', 'codigoArticulo', 'descripcionArticulo', 'codigoMotivo', 'descripcionMotivo', 'valeEstupefaciente', 'fechaCaducidad'],
            removeCabEmptyString: ['codigoRecogida', 'numeroAlbaranAbono', 'fechaAlbaranAbono', 'empresaFacturadora', 'observaciones'],
            removeCabEmptyArray: ['incidencias'],
            removeCabZeroValue: [],
            removeCabIfFalse: [],
            removePosEmptyString: ['numeroAlbaran', 'fechaAlbaran', 'descripcionArticulo', 'lote', 'fechaCaducidad', 'descripcionMotivo', 'valeEstupefaciente', 'observaciones'],
            removePosEmptyArray: ['incidencias'],
            removePosZeroValue: [],
            removePosIfFalse: []
        }
    },
    PROTOCOL_VERSION: '3.4.0',
    SERVER_VERSION: '0.9.3',
    TX_VERSION: 902,
    EXIT_CODES: {
        E_NO_CONFIG: 1,

        E_NO_SAP_SYSTEMS: 2,
        E_NO_DEFAULT_SAP_SYSTEM: 3,
        E_DEFAULT_SAP_SYSTEM_NO_EXISTS: 4,
        E_INVALID_SAP_SYSTEM: 5,

        E_NO_HTTP_CONFIG: 6,
        E_NO_HTTP_PORT: 7,
        E_HTTP_SERVER_ERROR: 10,

        E_NO_JWT_CONFIG: 12,
        E_JWT_NO_SIGN_KEY: 13,

        E_NO_MDB_CONFIG: 14,
        E_MDB_NO_HOSTS: 15,
        E_MDB_NO_USER: 16,
        E_MDB_NO_PASS: 17,
        E_MDB_NO_DATABASE: 18,
        E_MDB_NO_TXCOL: 19,
        E_MDB_NO_DISCARDCOL: 20,
        E_MDB_NO_LOGCOL: 21,

        E_NO_SQLITE_CONFIG: 22,
        E_SQLITE_NO_PATH: 23,
        E_NO_WATCHDOG_CONFIG: 24,

        E_NO_LDAP_CONFIG: 34,
        E_NO_LDAP_URL: 35,
        E_NO_LDAP_CA: 36,
        E_NO_MONITOR_CONFIG: 37,
        E_MONITOR_NO_HTTP: 38,

        E_NO_PRODUCTION_DEFINED: 43
    },
    PROCESS_TITLES: {
        CORE_MASTER: 'f3-core-master',
        CORE_WORKER: 'f3-core-worker',
        WATCHDOG: 'f3-watchdog',
        MONITOR: 'f3-monitor'
    },
    PROCESS_TYPES: {
        CORE_MASTER: 'core-master',
        CORE_WORKER: 'core-worker',
        WATCHDOG: 'watchdog',
        MONITOR: 'monitor'
    },
    PROCESS_REGISTER_INTERVAL: 10000,
    PROCESS_STATUS: {
        ALIVE: 0,
        MISSING: 10,
        DEAD: 99
    },
    DOMINIOS: {
        verificar: (dominio) => {
            var DOMINIOS = module.exports.DOMINIOS;

            if (dominio) {
                for (var domainIdx in DOMINIOS) {
                    if (DOMINIOS[domainIdx].toUpperCase) {
                        if (DOMINIOS[domainIdx].toUpperCase() === dominio.toUpperCase())
                            return DOMINIOS[domainIdx];
                    }
                }
            }
            return DOMINIOS.FEDICOM;
        },
        FEDICOM: 'FEDICOM',
        TRANSFER: 'transfer_laboratorio',
        HEFAME: 'HEFAME',
        EMPLEADO: 'empleado',
        FMASONLINE: 'F+Online',
        APIKEY: 'APIKEY' // DEPRECAR
    },
    FLAGS: {
        SQLITE: 'sqlite',
        RETRANSMISION_UPDATE: 'retransUpd',
        RETRANSMISION_NO_UPDATE: 'retransNoUpd',
        RETRANSMISION_UPDATE_WARN: 'retransUpdWarn',
        STATUS_FIX1: 'statusFix1',
        STATUS_FIX2: 'statusFix2',
        STATUS_FIX3: 'statusFix3',
        // WATCHDOG: 'watchdog',
        CLON: 'clon',
        CLONADO: 'clonado',
        NO_SAP: 'noSap',
        NO_FALTAS: 'noFaltas',
        ESTUPEFACIENTE: 'estupe',
        DUPLICADOS: 'dupes',
        BONIFICADO: 'bonif',
        TRANSFER:'transfer',
        FALTATOTAL: 'faltaTotal',
        FORMATO: 'formato',
        DEMORADO: 'demorado',
        VERSION: 'v',
        TOTALES: 's',
        TIPO: 't',
        PUNTO_ENTREGA: 'pt'
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
    }
}




