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
        PEDIDO: {
            NO_SAP: 3110,
            RECHAZADO_SAP: 3120,
            ESPERANDO_NUMERO_PEDIDO: 8010,
            SIN_NUMERO_PEDIDO_SAP: 9140,
            OK: 9900
        },
        RETRANSMISSION: {
            OK: 19001,
            IMPOSIBLE: 19002,
            SOLO_FORZANDO: 19003,
        }
    },
    SOFTWARE_ID: {
        HEFAME: '0026'
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
                sap_system: { ignore: true },

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
                descuentoPorcentaje: { remove: true },
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
                sap_system: { ignore: true },

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
            removeCab: ['login', 'crc', 'sap_pedidosasociados', 'sap_url_confirmacion', 'sap_pedidoprocesado', 'sap_tipopedido', 'sap_motivo_pedido', 'sap_cliente'],
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
    PROTOCOL_VERSION: '3.3.7',
    SERVER_VERSION: '0.8.2'

}




