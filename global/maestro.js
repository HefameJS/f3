'use strict';
//const C = global.config;
//const L = global.logger;
const K = global.constants;

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

class Almacen {
	constructor(codigo, descripcion) {
		this.codigo = codigo;
		this.descripcion = descripcion;
	}
}


let MAESTRO = {
	transmisiones: {
		pedidos: {
			tipo: [
				new Tipo(K.TX_TYPES.PEDIDO, 'Pedido', 'Petición para crear un pedido')
			],
			estados: [
				new Estado(K.TX_STATUS.RECEPCIONADO, 'Recepcionado', 'El pedido ha sido recibido y se está haciendo un examen preliminar del mismo'),
				new Estado(K.TX_STATUS.ESPERANDO_INCIDENCIAS, 'Esperando faltas', 'El pedido se ha enviado a SAP y está esperando que responda con las faltas'),
				new Estado(K.TX_STATUS.INCIDENCIAS_RECIBIDAS, 'Faltas recibidas', 'SAP ha contestado las faltas y se está generando la respuesta para el cliente'),
				new Estado(K.TX_STATUS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye un token válido'),
				new Estado(K.TX_STATUS.NO_AUTORIZADO, 'No autorizado', 'No está autorizado a crear pedidos en nombre del cliente indicado'),
				new Estado(K.TX_STATUS.PETICION_INCORRECTA, 'Petición incorrecta', 'La petición no contiene un pedido válido según la norma Fedicom3'),
				new Estado(K.TX_STATUS.NO_SAP, 'No SAP', 'No se ha logrado comunicar con SAP, la transmisión está pendiente de reenviarse'),
				new Estado(K.TX_STATUS.RECHAZADO_SAP, 'Rechazado por SAP', 'SAP ha indicado que el pedido no es válido'),
				new Estado(K.TX_STATUS.OK, 'OK', 'El pedido se ha grabado con éxito'),
				new Estado(K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO, 'Esperando grabación del pedido', 'Se han enviado las faltas del pedido al cliente, falta que SAP nos indique el número del pedido'),
				new Estado(K.TX_STATUS.PEDIDO.ESPERA_AGOTADA, 'Espera grabación pedido excedida', 'Se han enviado las faltas del pedido al cliente, pero SAP está tardando demasiado en indicar el número del pedido'),
				new Estado(K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP, 'Pedido no grabado', 'Se han enviado las faltas del pedido al cliente, pero SAP no ha creado el pedido'),
			],
			categoriasEstado: [
				new CategoriaEstado(1, 'Procesando',
					'Estados en los que el pedido está siendo procesado por el sistema', [
					K.TX_STATUS.RECEPCIONADO,
					K.TX_STATUS.ESPERANDO_INCIDENCIAS,
					K.TX_STATUS.INCIDENCIAS_RECIBIDAS,
					K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO
				]),
				new CategoriaEstado(2, 'Rechazado',
					'Pedidos que han sido rechazados por contener datos incorrectos', [
					K.TX_STATUS.FALLO_AUTENTICACION,
					K.TX_STATUS.NO_AUTORIZADO,
					K.TX_STATUS.PETICION_INCORRECTA,
					K.TX_STATUS.RECHAZADO_SAP
				]),
				new CategoriaEstado(3, 'Error',
					'Pedidos que están en un estado erróneo', [
					K.TX_STATUS.NO_SAP,
					K.TX_STATUS.MAX_RETRANSMISIONES,
					K.TX_STATUS.PEDIDO.ESPERA_AGOTADA,
					K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP
				]),
				new CategoriaEstado(4, 'Completado',
					'Pedidos que han sido grabados con éxito', [
					K.TX_STATUS.OK
				]),
			],
		},
		devoluciones: {
			tipos: [
				new Tipo(K.TX_TYPES.DEVOLUCION, 'Devolución', 'Petición para registrar una devolución')
			],
			estados: [
				new Estado(K.TX_STATUS.RECEPCIONADO, 'Recepcionada', 'La devolución ha sido recibida y se está haciendo un examen preliminar de la misma'),
				new Estado(K.TX_STATUS.ESPERANDO_INCIDENCIAS, 'Esperando a SAP', 'Se ha enviado a SAP para que grabe la devolución'),
				new Estado(K.TX_STATUS.INCIDENCIAS_RECIBIDAS, 'SAP ha respondido', 'Se está procesando la respuesta de SAP'),
				new Estado(K.TX_STATUS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye un token válido'),
				new Estado(K.TX_STATUS.NO_AUTORIZADO, 'No autorizado', 'No está autorizado a realizar la devolución para este código de cliente'),
				new Estado(K.TX_STATUS.PETICION_INCORRECTA, 'Petición incorrecta', 'La petición no contiene una devolución válida según la norma Fedicom3'),
				new Estado(K.TX_STATUS.RECHAZADO_SAP, 'Rechazado por SAP', 'SAP ha indicado que la devolución no contiene datos válidos'),
				new Estado(K.TX_STATUS.ERROR_RESPUESTA_SAP, 'Error SAP', 'SAP ha devuelto un error en la llamada'),
				new Estado(K.TX_STATUS.OK, 'Completada', 'Devolución registrada con éxito'),
				new Estado(K.TX_STATUS.DEVOLUCION.PARCIAL, 'Devolución parcial', 'La devolución se ha registrado, pero no todas las líneas han sido aceptadas por contener errores'),
				new Estado(K.TX_STATUS.DEVOLUCION.RECHAZO_TOTAL, 'Devolución rechazada', 'La devolución no se ha registrado porque todas las líneas contienen errores'),
			],
			categoriasEstado: [
				new CategoriaEstado(1, 'Procesando',
					'Devoluciones que están siendo procesadas por el sistema', [
					K.TX_STATUS.RECEPCIONADO,
					K.TX_STATUS.ESPERANDO_INCIDENCIAS,
					K.TX_STATUS.INCIDENCIAS_RECIBIDAS
				]),
				new CategoriaEstado(2, 'Rechazado',
					'Devoluciones que no se procesaron por contener datos incorrectos', [
					K.TX_STATUS.FALLO_AUTENTICACION,
					K.TX_STATUS.NO_AUTORIZADO,
					K.TX_STATUS.PETICION_INCORRECTA,
					K.TX_STATUS.RECHAZADO_SAP,
					K.TX_STATUS.DEVOLUCION.RECHAZO_TOTAL
				]),
				new CategoriaEstado(3, 'Error',
					'Devoluciones que están en un estado erróneo', [
					K.TX_STATUS.ERROR_RESPUESTA_SAP
				]),
				new CategoriaEstado(4, 'Completado',
					'Devoluciones cuyo procesamiento ha finalizado', [
					K.TX_STATUS.OK,
					K.TX_STATUS.DEVOLUCION.PARCIAL
				]),
			],
		},
		logistica: {
			tipo: [
				new Tipo(K.TX_TYPES.LOGISTICA, 'Logística', 'Petición para registrar un pedido de logística')
			],
			estados: [
				new Estado(K.TX_STATUS.RECEPCIONADO, 'Recepcionada', 'La transmisión de logística ha sido recibida y se está haciendo un examen preliminar de la misma'),
				new Estado(K.TX_STATUS.ESPERANDO_INCIDENCIAS, 'Esperando a SAP', 'Se ha enviado a SAP para que grabe la petición'),
				new Estado(K.TX_STATUS.INCIDENCIAS_RECIBIDAS, 'SAP ha respondido', 'SAP ha contestado y se está generando la respuesta para el cliente'),
				new Estado(K.TX_STATUS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye un token válido'),
				new Estado(K.TX_STATUS.NO_AUTORIZADO, 'No autorizado', 'No está autorizado a realizar el pedido de logística'),
				new Estado(K.TX_STATUS.PETICION_INCORRECTA, 'Petición incorrecta', 'La petición no contiene un pedido de logística válido según la norma Fedicom3'),
				new Estado(K.TX_STATUS.RECHAZADO_SAP, 'Rechazado por SAP', 'SAP ha indicado que la transmisión no contiene datos válidos'),
				new Estado(K.TX_STATUS.ERROR_RESPUESTA_SAP, 'Error SAP', 'Ocurrió un error en la llamada a SAP'),
				new Estado(K.TX_STATUS.OK, 'Completada', 'Pedido de logística grabado con éxito'),
				new Estado(K.TX_STATUS.LOGISTICA.SIN_NUMERO_LOGISTICA, 'Sin número de logística', 'SAP no ha devuelto el número de logística asociado al pedido'),
			],
			categoriasEstado: [
				new CategoriaEstado(1, 'Procesando',
					'Estados en los que el pedido de logística está siendo procesado por el sistema', [
					K.TX_STATUS.RECEPCIONADO,
					K.TX_STATUS.ESPERANDO_INCIDENCIAS,
					K.TX_STATUS.INCIDENCIAS_RECIBIDAS
				]),
				new CategoriaEstado(2, 'Rechazado',
					'Pedidos de logística que no se procesaron por contener datos incorrectos', [
					K.TX_STATUS.FALLO_AUTENTICACION,
					K.TX_STATUS.NO_AUTORIZADO,
					K.TX_STATUS.PETICION_INCORRECTA,
					K.TX_STATUS.RECHAZADO_SAP,
					K.TX_STATUS.LOGISTICA.SIN_NUMERO_LOGISTICA,
				]),
				new CategoriaEstado(3, 'Error',
					'Pedidos de logística que están en un estado erróneo', [
					K.TX_STATUS.ERROR_RESPUESTA_SAP
				]),
				new CategoriaEstado(4, 'Completado',
					'Pedidos de logística grabados con éxito', [
					K.TX_STATUS.OK
				]),
			],
		},
		consultas: {
			tipo: [
				new Tipo(K.TX_TYPES.CONSULTA_PEDIDO, 'Consulta pedido', 'Consulta de la información de un pedido'),
				new Tipo(K.TX_TYPES.CONSULTA_DEVOLUCION, 'Consulta devolucion', 'Consulta de la información de una devolución'),
				new Tipo(K.TX_TYPES.CONSULTA_LOGISTICA, 'Consulta logística', 'Consulta de la información de un pedido de logística'),
				new Tipo(K.TX_TYPES.BUSCAR_ALBARANES, 'Búsqueda de albaranes', 'Consulta de un listado de albaranes'),
				new Tipo(K.TX_TYPES.CONSULTAR_ALBARAN, 'Consulta albarán', 'Consulta de la información de un albarán'),
				new Tipo(K.TX_TYPES.BUSCAR_FACTURAS, 'Búsqueda de facturas', 'Consulta de un listado de facturas'),
				new Tipo(K.TX_TYPES.CONSULTAR_FACTURA, 'Consulta factura', 'Consulta de la información de una factura')
			],
			estados: [
				new Estado(K.TX_STATUS.RECEPCIONADO, 'Recepcionada', 'La consulta ha sido recibida y se está haciendo un examen preliminar de la misma'),
				new Estado(K.TX_STATUS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye un token válido'),
				new Estado(K.TX_STATUS.NO_AUTORIZADO, 'No autorizado', 'No está autorizado a realizar la consulta solicitada'),
				new Estado(K.TX_STATUS.PETICION_INCORRECTA, 'Petición incorrecta', 'La consulta no es válida según la norma Fedicom3'),
				new Estado(K.TX_STATUS.ERROR_RESPUESTA_SAP, 'Error SAP', 'SAP ha devuelto un error en la consulta'),
				new Estado(K.TX_STATUS.OK, 'Completada', 'Consulta completada con éxito'),
				new Estado(K.TX_STATUS.CONSULTA.ERROR_DB, 'Error en consulta', 'Ocurrió un error al realizar la consulta'),
				new Estado(K.TX_STATUS.CONSULTA.NO_EXISTE, 'Sin resultados', 'La consulta no obtuvo resultados'),
			],
			categoriasEstado: [
				new CategoriaEstado(1, 'Procesando',
					'Estados en los que la consulta está siendo procesada por el sistema', [
					K.TX_STATUS.RECEPCIONADO
				]),
				new CategoriaEstado(1, 'Rechazado',
					'Consultas que no se procesaron por contener datos incorrectos', [
					K.TX_STATUS.FALLO_AUTENTICACION,
					K.TX_STATUS.NO_AUTORIZADO,
					K.TX_STATUS.PETICION_INCORRECTA
				]),
				new CategoriaEstado(1, 'Error',
					'Transmisiones que están en un estado erróneo', [
					K.TX_STATUS.ERROR_RESPUESTA_SAP,
					K.TX_STATUS.CONSULTA.ERROR_DB
				]),
				new CategoriaEstado(1, 'Completado',
					'Consultas finalizadas', [
					K.TX_STATUS.OK,
					K.TX_STATUS.CONSULTA.NO_EXISTE
				]),
			],
		},
		autenticacion: {
			tipo: [
				new Tipo(K.TX_TYPES.AUTENTICACION, 'Autenticación', 'Solicitud de un token de autenticación'),
			],
			estados: [
				new Estado(K.TX_STATUS.RECEPCIONADO, 'Recepcionada', 'La solicitud ha sido recibida y se está haciendo un examen preliminar del misma'),
				new Estado(K.TX_STATUS.ESPERANDO_INCIDENCIAS, 'Consultando a SAP', 'Las credenciales se están comprobando en SAP'),
				new Estado(K.TX_STATUS.INCIDENCIAS_RECIBIDAS, 'SAP respondido', 'SAP ha informado si las credenciales son correctas, se prepara la respuesta al cliente'),
				new Estado(K.TX_STATUS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye credenciales válidas'),
				new Estado(K.TX_STATUS.PETICION_INCORRECTA, 'Petición incorrecta', 'La petición no cumple la norma Fedicom3'),
				new Estado(K.TX_STATUS.ERROR_RESPUESTA_SAP, 'Error SAP', 'No se ha logrado comunicar con SAP'),
				new Estado(K.TX_STATUS.OK, 'OK', 'Se ha generado el token correctamente'),
			],
			categoriasEstado: [
				new CategoriaEstado(1, 'Procesando',
					'Estados en los que la petición está siendo procesada por el sistema', [
					K.TX_STATUS.RECEPCIONADO,
					K.TX_STATUS.ESPERANDO_INCIDENCIAS,
					K.TX_STATUS.INCIDENCIAS_RECIBIDAS,
				]),
				new CategoriaEstado(2, 'Rechazada',
					'Peticiones rechazadas por contener datos incorrectos', [
					K.TX_STATUS.FALLO_AUTENTICACION,
					K.TX_STATUS.PETICION_INCORRECTA,
				]),
				new CategoriaEstado(3, 'Error',
					'Peticiones que están en un estado erróneo', [
					K.TX_STATUS.PETICION_INCORRECTA,
				]),
				new CategoriaEstado(4, 'Completada',
					'Peticiones que han sido grabadas con éxito', [
					K.TX_STATUS.OK
				]),
			],
		},
		confirmacionAlbaran: {
			tipo: [
				new Tipo(K.TX_TYPES.CONFIRMACION_ALBARAN, 'Confirmación línea albarán', 'Confirmación de la recepción de una línea de albarán'),
			],
			estados: [
				new Estado(K.TX_STATUS.FALLO_AUTENTICACION, 'Fallo de autenticación', 'La petición no incluye un token válido'),
				new Estado(K.TX_STATUS.NO_AUTORIZADO, 'No autorizado', 'No está autorizado a confirmar líneas de albarán en nombre del cliente indicado'),
				new Estado(K.TX_STATUS.PETICION_INCORRECTA, 'Petición incorrecta', 'La petición no es válida según la norma Fedicom3'),
				new Estado(K.TX_STATUS.OK, 'OK', 'Confirmación grabada con éxito'),
			],
			categoriasEstado: [
				new CategoriaEstado(2, 'Rechazada',
					'Peticiones que han sido rechazadas por contener datos incorrectos', [
					K.TX_STATUS.FALLO_AUTENTICACION,
					K.TX_STATUS.NO_AUTORIZADO,
					K.TX_STATUS.PETICION_INCORRECTA
				]),
				new CategoriaEstado(4, 'Completada',
					'Confirmaciones que han sido grabadas con éxito', [
					K.TX_STATUS.OK
				]),
			],
		}
	},
	codigosProgramaFarmacia: {
		8: "Bidafarma Informatica",
		10: "Farmabrain Centro Farmaceutico",
		12: "Unycop",
		18: "Ecaputo Quadrom Services",
		26: "HEFAME",
		28: "IOFWin Fedefarma",
		33: "FarmaLOG Eurosof2000",
		35: "Consoft",
		36: "Kernel informatica",
		38: "Farmatic Consoft",
		40: "Efiplan Soluciones",
		48: "Pulso Informatica",
		54: "Bidafarma",
		56: "Farmacia Manoteras",
		58: "C.O.F. Santa Cruz de Tenerife",
		59: "Tedifarma",
		61: "Tedifarma 2",
		64: "Acofarma",
		67: "Merck Sharp & Dohme España",
		68: "Assoes SLU Software Andorra",
		70: "Belta Mar",
		71: "BitFarma",
		74: "Farmacia Reche Europa",
		78: "Profesionalfarma",
		79: "Grupodwes Web Design",
		80: "ekon",
		81: "Hiberus Digital",
		82: "Quadralia",
		87: "Xeosefa",
		91: "LR Informatica",
		92: "Marka Informática",
		93: "Medigest Consultores",
		94: "Medigest Consultores",
		95: "Farmages",
		97: "Desarrollos Lugonet",
		98: "Desarrollos Lugonet",
		99: "Gularis Soft",
		101: "Bidafarma Informatica",
		104: "Cefisa Informatica",
		105: "40300047E",
		106: "Farmacia Carme Vilaltella",
		107: "Etron Software S.L.",
		108: "Farmacia Herrera Martín",
		109: "Novofarma",
		111: "Farmacia Araceli Pérez",
		112: "Farmacia Araceli Pérez",
		113: "PharmaEthikos",
		118: "Farmacia Marta Castro",
		121: "Farmacia Ines Alvarez",
		9000: "Postman",
		9001: "Simulador",
		9002: "Retransmisor",
		9003: "Test Unitario",
		9100: "Traductor Fedicom2",
		9700: "Aplicacion Empleado Hefame",
		9800: "F+Online",
		9801: "Portal Web Hefame",
		9802: "MICOF - Muy Ilustre Colegio Oficial de Farmacéuticos de Valencia",
		9991: "SAP D01",
		9992: "SAP T01",
		9993: "SAP P01"
	},
	almacenes: {
		"RG01": "Santomera",
		"RG02": "Borgino",
		"RG03": "Cartagena",
		"RG04": "Madrid",
		"RG05": "Barcelona viejo",
		"RG06": "Alicante",
		"RG07": "Almería",
		"RG08": "Albacete",
		"RG09": "Málaga viejo",
		"RG10": "Valencia",
		"RG13": "Madrid viejo",
		"RG15": "Barcelona",
		"RG16": "Tortosa",
		"RG17": "Melilla",
		"RG18": "Granada",
		"RG19": "Malaga",
		"RG99": "Almacén de prueba"
	},
	laboratorios: {
		'60200357': 'INDAS',
		'60200614': 'PFIZER',
		'60200118': 'CINFA',
		'60201909': 'STADA',
		'60202977': 'TEVA',
		'60201230': 'MEDA-PHARMA',
		'60203056': 'QUALIGEN',
		'60202713': 'KERN',
		'60202056': 'RATIOPHARM',
		'60203087': 'ACTAVIS',
		'60202004': 'ITALFARMACO',
		'60202331': 'RINTER',
		'60202979': 'RINTER CORONA',
		'60202707': 'IODES',
		'60200002': 'ABBOT PEDIASURE',
		'60200561': 'NORMON',
		'60203123': 'Lab60203123',
		'60203226': 'PFIZER_2',
		'60200767': 'HARTMANN',
		'60203449': 'ABBOT-BGP',
		'60202422': 'MABOFARMA',
		'60202740': 'APOTEX',
		'60203401': 'Lab60203401',
		'60200282': 'SANDOZ',
		'60202659': 'BEXAL',
		'60203016': 'Lab60203016',
		'60202637': 'Lab60202637',
		'60200223': 'ESTEVE',
		'60202374': 'EFFIK',
		'60202256': 'Lab60202256',
		'60202257': 'Lab60202257',
		'60202833': 'MYLAN',
		'60200253': 'FERRER INTERNACIONAL',
		'60200020': 'DAIICHI-SANKYO',
		'60202430': 'OMEGA-PHARMA'
	},
	tiposTransfer: {
		TR: 'Transfer normal',
		TG: 'Transfer gratuito',
		TP: 'Transfer portal'
	},
	listaNegra: {
		clientes: []
	}
}




MAESTRO.transmisiones.getEstadoById = function (codigoEstado, tipoTransmision) {
	return MAESTRO.transmisiones[tipoTransmision]?.estados.find( e => e.codigo === codigoEstado );
}

MAESTRO.almacenes.getNombreById = function (codigoAlmacen) {
	return MAESTRO.almacenes[codigoAlmacen] || codigoAlmacen;
}


module.exports = MAESTRO;


