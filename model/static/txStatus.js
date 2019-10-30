'use strict';

// 9XXX - Estados Finales
// 1XXX - Estados Iniciales

module.exports = {
	DESCONOCIDO: -1,

	RECEPCIONADO: 1010,
	ESPERANDO_INCIDENCIAS: 1020,
	INCIDENCIAS_RECIBIDAS: 1030,



	FALLO_AUTENTICACION: 3010,
	PETICION_INCORRECTA: 3020,


	NO_SAP: 3110,
	RECHAZADO_SAP: 3120,


	ESPERANDO_NUMERO_PEDIDO: 8010,
	ESPERA_AGOTADA: 8100,

	ERROR_INTERNO: 9000,
	SISTEMA_SAP_NO_DEFINIDO: 9001,
	RETRANSMISION_IMPOSIBLE: 9002,
	RETRANSMISION_SOLO_FORZANDO: 9003,
	NO_EXISTE_PEDIDO: 9004,

	DESCARTADO: 9110,
	DUPLICADO: 9120,
	CONFIRMACION_RECUPERADA: 9130,

	SIN_NUMERO_PEDIDO_SAP: 9140,

	OK: 9900
};
