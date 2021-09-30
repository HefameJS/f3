'use strict';
const K = global.K;

class CategoriaEstado {
	constructor(codigo, descripcionCorta, descripcionLarga, estadosAsociados) {
		this.codigo = codigo;
		this.descripcionCorta = descripcionCorta;
		this.descripcionLarga = descripcionLarga;
		this.estadosAsociados = estadosAsociados;
	}
}

class Estado {
	constructor(codigo, descripcionCorta, descripcionLarga) {
		this.codigo = codigo;
		this.descripcionCorta = descripcionCorta;
		this.descripcionLarga = descripcionLarga;
	}
}

class Tipo {
	constructor(codigo, descripcionCorta, descripcionLarga) {
		this.codigo = codigo;
		this.descripcionCorta = descripcionCorta;
		this.descripcionLarga = descripcionLarga;
	}
}

let MAESTRO = {
	transmisiones: {
		pedidos: {
			tipo: [
				new Tipo(K.TIPOS.CREAR_PEDIDO, 'Pedido', 'Petición para crear un pedido')
			],
			estados: [
				new Estado(K.ESTADOS.RECEPCIONADO, 'Recepcionado', 'El pedido ha sido recibido y se está haciendo un examen preliminar del mismo'),
				new Estado(K.ESTADOS.ESPERANDO_INCIDENCIAS, 'Esperando faltas', 'El pedido se ha enviado a SAP y está esperando que responda con las faltas'),
				new Estado(K.ESTADOS.INCIDENCIAS_RECIBIDAS, 'Faltas recibidas', 'SAP ha contestado las faltas y se está generando la respuesta para el cliente'),
				new Estado(K.ESTADOS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye un token válido'),
				new Estado(K.ESTADOS.NO_AUTORIZADO, 'No autorizado', 'No está autorizado a crear pedidos en nombre del cliente indicado'),
				new Estado(K.ESTADOS.PETICION_INCORRECTA, 'Petición incorrecta', 'La petición no contiene un pedido válido según la norma Fedicom3'),
				new Estado(K.ESTADOS.DUPLICADO, 'Petición duplicada', 'La petición se ha detectado como duplicado de otra'),
				new Estado(K.ESTADOS.NO_SAP, 'No SAP', 'No se ha logrado comunicar con SAP, la transmisión está pendiente de reenviarse'),
				new Estado(K.ESTADOS.RECHAZADO_SAP, 'Rechazado por SAP', 'SAP ha indicado que el pedido no es válido'),
				new Estado(K.ESTADOS.COMPLETADO, 'OK', 'El pedido se ha grabado con éxito'),
				new Estado(K.ESTADOS.PEDIDO.ESPERANDO_NUMERO_PEDIDO, 'Esperando grabación del pedido', 'Se han enviado las faltas del pedido al cliente, falta que SAP nos indique el número del pedido'),
				new Estado(K.ESTADOS.PEDIDO.ESPERA_AGOTADA, 'Espera grabación pedido excedida', 'Se han enviado las faltas del pedido al cliente, pero SAP está tardando demasiado en indicar el número del pedido'),
				new Estado(K.ESTADOS.PEDIDO.SIN_NUMERO_PEDIDO_SAP, 'Pedido no grabado', 'Se han enviado las faltas del pedido al cliente, pero SAP no ha creado el pedido'),
			],
			categoriasEstado: [
				new CategoriaEstado(1, 'Procesando',
					'Estados en los que el pedido está siendo procesado por el sistema', [
					K.ESTADOS.RECEPCIONADO,
					K.ESTADOS.ESPERANDO_INCIDENCIAS,
					K.ESTADOS.INCIDENCIAS_RECIBIDAS,
					K.ESTADOS.PEDIDO.ESPERANDO_NUMERO_PEDIDO
				]),
				new CategoriaEstado(2, 'Rechazado',
					'Pedidos que han sido rechazados por contener datos incorrectos', [
					K.ESTADOS.FALLO_AUTENTICACION,
					K.ESTADOS.NO_AUTORIZADO,
					K.ESTADOS.PETICION_INCORRECTA,
					K.ESTADOS.RECHAZADO_SAP,
					K.ESTADOS.DUPLICADO
				]),
				new CategoriaEstado(3, 'Error',
					'Pedidos que están en un estado erróneo', [
					K.ESTADOS.NO_SAP,
					K.ESTADOS.PEDIDO.ESPERA_AGOTADA,
					K.ESTADOS.PEDIDO.SIN_NUMERO_PEDIDO_SAP
				]),
				new CategoriaEstado(4, 'Completado',
					'Pedidos que han sido grabados con éxito', [
					K.ESTADOS.COMPLETADO
				]),
			],
		},
		devoluciones: {
			tipos: [
				new Tipo(K.TIPOS.CREAR_DEVOLUCION, 'Devolución', 'Petición para registrar una devolución')
			],
			estados: [
				new Estado(K.ESTADOS.RECEPCIONADO, 'Recepcionada', 'La devolución ha sido recibida y se está haciendo un examen preliminar de la misma'),
				new Estado(K.ESTADOS.ESPERANDO_INCIDENCIAS, 'Esperando a SAP', 'Se ha enviado a SAP para que grabe la devolución'),
				new Estado(K.ESTADOS.INCIDENCIAS_RECIBIDAS, 'SAP ha respondido', 'Se está procesando la respuesta de SAP'),
				new Estado(K.ESTADOS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye un token válido'),
				new Estado(K.ESTADOS.NO_AUTORIZADO, 'No autorizado', 'No está autorizado a realizar la devolución para este código de cliente'),
				new Estado(K.ESTADOS.PETICION_INCORRECTA, 'Petición incorrecta', 'La petición no contiene una devolución válida según la norma Fedicom3'),
				new Estado(K.ESTADOS.RECHAZADO_SAP, 'Rechazado por SAP', 'SAP ha indicado que la devolución no contiene datos válidos'),
				new Estado(K.ESTADOS.ERROR_RESPUESTA_SAP, 'Error SAP', 'SAP ha devuelto un error en la llamada'),
				new Estado(K.ESTADOS.COMPLETADO, 'Completada', 'Devolución registrada con éxito'),
				new Estado(K.ESTADOS.DEVOLUCION.PARCIAL, 'Devolución parcial', 'La devolución se ha registrado, pero no todas las líneas han sido aceptadas por contener errores'),
				new Estado(K.ESTADOS.DEVOLUCION.RECHAZADA, 'Devolución rechazada', 'La devolución no se ha registrado porque ninguna línea ha sido aceptada'),
			],
			categoriasEstado: [
				new CategoriaEstado(1, 'Procesando',
					'Devoluciones que están siendo procesadas por el sistema', [
					K.ESTADOS.RECEPCIONADO,
					K.ESTADOS.ESPERANDO_INCIDENCIAS,
					K.ESTADOS.INCIDENCIAS_RECIBIDAS
				]),
				new CategoriaEstado(2, 'Rechazado',
					'Devoluciones que no se procesaron por contener datos incorrectos', [
					K.ESTADOS.FALLO_AUTENTICACION,
					K.ESTADOS.NO_AUTORIZADO,
					K.ESTADOS.PETICION_INCORRECTA,
					K.ESTADOS.RECHAZADO_SAP,
					K.ESTADOS.DEVOLUCION.RECHAZADA
				]),
				new CategoriaEstado(3, 'Error',
					'Devoluciones que están en un estado erróneo', [
					K.ESTADOS.ERROR_RESPUESTA_SAP
				]),
				new CategoriaEstado(4, 'Completado',
					'Devoluciones cuyo procesamiento ha finalizado', [
					K.ESTADOS.COMPLETADO,
					K.ESTADOS.DEVOLUCION.PARCIAL
				]),
			],
		},
		logistica: {
			tipo: [
				new Tipo(K.TIPOS.LOGISTICA, 'Logística', 'Petición para registrar un pedido de logística')
			],
			estados: [
				new Estado(K.ESTADOS.RECEPCIONADO, 'Recepcionada', 'La transmisión de logística ha sido recibida y se está haciendo un examen preliminar de la misma'),
				new Estado(K.ESTADOS.ESPERANDO_INCIDENCIAS, 'Esperando a SAP', 'Se ha enviado a SAP para que grabe la petición'),
				new Estado(K.ESTADOS.INCIDENCIAS_RECIBIDAS, 'SAP ha respondido', 'SAP ha contestado y se está generando la respuesta para el cliente'),
				new Estado(K.ESTADOS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye un token válido'),
				new Estado(K.ESTADOS.NO_AUTORIZADO, 'No autorizado', 'No está autorizado a realizar el pedido de logística'),
				new Estado(K.ESTADOS.PETICION_INCORRECTA, 'Petición incorrecta', 'La petición no contiene un pedido de logística válido según la norma Fedicom3'),
				new Estado(K.ESTADOS.DUPLICADO, 'Petición duplicada', 'La petición se ha detectado como duplicado de otra'),
				new Estado(K.ESTADOS.RECHAZADO_SAP, 'Rechazado por SAP', 'SAP ha indicado que la transmisión no contiene datos válidos'),
				new Estado(K.ESTADOS.ERROR_RESPUESTA_SAP, 'Error SAP', 'Ocurrió un error en la llamada a SAP'),
				new Estado(K.ESTADOS.COMPLETADO, 'Completada', 'Pedido de logística grabado con éxito'),
				new Estado(K.ESTADOS.LOGISTICA.SIN_NUMERO_LOGISTICA, 'Sin número de logística', 'SAP no ha devuelto el número de logística asociado al pedido'),
			],
			categoriasEstado: [
				new CategoriaEstado(1, 'Procesando',
					'Estados en los que el pedido de logística está siendo procesado por el sistema', [
						K.ESTADOS.RECEPCIONADO,
						K.ESTADOS.ESPERANDO_INCIDENCIAS,
						K.ESTADOS.INCIDENCIAS_RECIBIDAS
				]),
				new CategoriaEstado(2, 'Rechazado',
					'Pedidos de logística que no se procesaron por contener datos incorrectos', [
						K.ESTADOS.FALLO_AUTENTICACION,
						K.ESTADOS.NO_AUTORIZADO,
						K.ESTADOS.PETICION_INCORRECTA,
						K.ESTADOS.RECHAZADO_SAP,
						K.ESTADOS.LOGISTICA.SIN_NUMERO_LOGISTICA,
						K.ESTADOS.DUPLICADO,
				]),
				new CategoriaEstado(3, 'Error',
					'Pedidos de logística que están en un estado erróneo', [
						K.ESTADOS.ERROR_RESPUESTA_SAP
				]),
				new CategoriaEstado(4, 'Completado',
					'Pedidos de logística grabados con éxito', [
					K.ESTADOS.COMPLETADO
				]),
			],
		},
		consultas: {
			tipo: [
				new Tipo(K.TIPOS.CONSULTAR_PEDIDO, 'Consulta pedido', 'Consulta de la información de un pedido'),
				new Tipo(K.TIPOS.CONSULTA_DEVOLUCION, 'Consulta devolucion', 'Consulta de la información de una devolución'),
				new Tipo(K.TIPOS.CONSULTA_LOGISTICA, 'Consulta logística', 'Consulta de la información de un pedido de logística'),
				new Tipo(K.TIPOS.BUSCAR_ALBARANES, 'Búsqueda de albaranes', 'Consulta de un listado de albaranes'),
				new Tipo(K.TIPOS.CONSULTAR_ALBARAN, 'Consulta albarán', 'Consulta de la información de un albarán'),
				new Tipo(K.TIPOS.BUSCAR_FACTURAS, 'Búsqueda de facturas', 'Consulta de un listado de facturas'),
				new Tipo(K.TIPOS.CONSULTAR_FACTURA, 'Consulta factura', 'Consulta de la información de una factura')
			],
			estados: [
				new Estado(K.ESTADOS.RECEPCIONADO, 'Recepcionada', 'La consulta ha sido recibida y se está haciendo un examen preliminar de la misma'),
				new Estado(K.ESTADOS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye un token válido'),
				new Estado(K.ESTADOS.NO_AUTORIZADO, 'No autorizado', 'No está autorizado a realizar la consulta solicitada'),
				new Estado(K.ESTADOS.PETICION_INCORRECTA, 'Petición incorrecta', 'La consulta no es válida según la norma Fedicom3'),
				new Estado(K.ESTADOS.ERROR_RESPUESTA_SAP, 'Error SAP', 'SAP ha devuelto un error en la consulta'),
				new Estado(K.ESTADOS.COMPLETADO, 'Completada', 'Consulta completada con éxito'),
				new Estado(K.ESTADOS.CONSULTA.ERROR, 'Error en consulta', 'Ocurrió un error al realizar la consulta'),
				new Estado(K.ESTADOS.CONSULTA.NO_EXISTE, 'Sin resultados', 'La consulta no obtuvo resultados'),
			],
			categoriasEstado: [
				new CategoriaEstado(1, 'Procesando',
					'Estados en los que la consulta está siendo procesada por el sistema', [
					K.ESTADOS.RECEPCIONADO
				]),
				new CategoriaEstado(1, 'Rechazado',
					'Consultas que no se procesaron por contener datos incorrectos', [
					K.ESTADOS.FALLO_AUTENTICACION,
					K.ESTADOS.NO_AUTORIZADO,
					K.ESTADOS.PETICION_INCORRECTA
				]),
				new CategoriaEstado(1, 'Error',
					'Transmisiones que están en un estado erróneo', [
					K.ESTADOS.ERROR_RESPUESTA_SAP,
					K.ESTADOS.CONSULTA.ERROR
				]),
				new CategoriaEstado(1, 'Completado',
					'Consultas finalizadas', [
					K.ESTADOS.COMPLETADO,
					K.ESTADOS.CONSULTA.NO_EXISTE
				]),
			],
		},
		autenticacion: {
			tipo: [
				new Tipo(K.TIPOS.AUTENTICACION, 'Autenticación', 'Solicitud de un token de autenticación'),
			],
			estados: [
				new Estado(K.ESTADOS.RECEPCIONADO, 'Recepcionada', 'La solicitud ha sido recibida y se está haciendo un examen preliminar del misma'),
				new Estado(K.ESTADOS.ESPERANDO_INCIDENCIAS, 'Consultando a SAP', 'Las credenciales se están comprobando en SAP'),
				new Estado(K.ESTADOS.INCIDENCIAS_RECIBIDAS, 'SAP respondido', 'SAP ha informado si las credenciales son correctas, se prepara la respuesta al cliente'),
				new Estado(K.ESTADOS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye credenciales válidas'),
				new Estado(K.ESTADOS.PETICION_INCORRECTA, 'Petición incorrecta', 'La petición no cumple la norma Fedicom3'),
				new Estado(K.ESTADOS.ERROR_RESPUESTA_SAP, 'Error SAP', 'No se ha logrado comunicar con SAP'),
				new Estado(K.ESTADOS.COMPLETADO, 'OK', 'Se ha generado el token correctamente'),
			],
			categoriasEstado: [
				new CategoriaEstado(1, 'Procesando',
					'Estados en los que la petición está siendo procesada por el sistema', [
						K.ESTADOS.RECEPCIONADO,
						K.ESTADOS.ESPERANDO_INCIDENCIAS,
						K.ESTADOS.INCIDENCIAS_RECIBIDAS,
				]),
				new CategoriaEstado(2, 'Rechazada',
					'Peticiones rechazadas por contener datos incorrectos', [
						K.ESTADOS.FALLO_AUTENTICACION,
						K.ESTADOS.PETICION_INCORRECTA,
				]),
				new CategoriaEstado(3, 'Error',
					'Peticiones que están en un estado erróneo', [
						K.ESTADOS.PETICION_INCORRECTA,
				]),
				new CategoriaEstado(4, 'Completada',
					'Peticiones que han sido grabadas con éxito', [
						K.ESTADOS.COMPLETADO
				]),
			],
		},
		confirmacionAlbaran: {
			tipo: [
				new Tipo(K.TIPOS.CONFIRMACION_ALBARAN, 'Confirmación línea albarán', 'Confirmación de la recepción de una línea de albarán'),
			],
			estados: [
				new Estado(K.ESTADOS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye un token válido'),
				new Estado(K.ESTADOS.NO_AUTORIZADO, 'No autorizado', 'No está autorizado a confirmar líneas de albarán en nombre del cliente indicado'),
				new Estado(K.ESTADOS.PETICION_INCORRECTA, 'Petición incorrecta', 'La petición no es válida según la norma Fedicom3'),
				new Estado(K.ESTADOS.COMPLETADO, 'OK', 'Confirmación grabada con éxito'),
			],
			categoriasEstado: [
				new CategoriaEstado(2, 'Rechazada',
					'Peticiones que han sido rechazadas por contener datos incorrectos', [
					K.ESTADOS.FALLO_AUTENTICACION,
					K.ESTADOS.NO_AUTORIZADO,
					K.ESTADOS.PETICION_INCORRECTA
				]),
				new CategoriaEstado(4, 'Completada',
					'Confirmaciones que han sido grabadas con éxito', [
					K.ESTADOS.COMPLETADO
				]),
			],
		}
	},
}




MAESTRO.transmisiones.getEstadoById = function (codigoEstado, tipoTransmision) {
	return MAESTRO.transmisiones[tipoTransmision]?.estados.find(e => e.codigo === codigoEstado);
}



module.exports = MAESTRO;


