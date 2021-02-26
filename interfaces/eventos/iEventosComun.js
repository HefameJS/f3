'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;



const generarEventoDeApertura = (req, tipo, estado) => {

	let txId = req.txId;
	return {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: estado
		},
		$set: {
			authenticatingUser: req.identificarUsuarioAutenticado(),
			client: req.identificarClienteSap(),
			iid: global.instanceID,
			type: tipo,
			clientRequest: {
				authentication: req.token,
				ip: req.ipOrigen,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				route: req.route.path,
				headers: req.headers,
				body: req.body
			}
		}
	}

}

const generarEventoDeCierre = (res, cuerpoRespuesta, estado) => {

	let txId = res.txId;
	return {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: estado,
		},
		$set: {
			clientResponse: {
				timestamp: new Date(),
				status: res.statusCode,
				headers: res.getHeaders(),
				body: cuerpoRespuesta
			}
		}
	}
}

const generarEventoCompleto = (req, res, cuerpoRespuesta, tipo, estado) => {

	let txId = req.txId;

	return {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: estado
		},
		$set: {
			authenticatingUser: req.identificarUsuarioAutenticado(),
			client: req.identificarClienteSap(),
			iid: global.instanceID,
			type: tipo,
			clientRequest: {
				authentication: req.token,
				ip: req.ipOrigen,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				route: req.route.path,
				headers: req.headers,
				body: req.body
			},
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: cuerpoRespuesta
			}
		}
	}

}


module.exports = {
	generarEventoCompleto,
	generarEventoDeCierre,
	generarEventoDeApertura
}
