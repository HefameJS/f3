const L = global.L;
const K = global.K;

const WebSocketServer = require('websocket').server;
const http = require('http');

class ServidorWebSocket {

	#puerto;
	#log;
	#servidorHttp;
	#servidorWs;

	#clientes = [];
	#canales = {};

	constructor(puerto) {

		this.#puerto = puerto;
		this.#log = L.instanciar({ txId: 'WebSocketServer' });

		this.#servidorHttp = http.createServer((request, response) => {
			response.writeHead(404);
			response.end();
		});

		this.#servidorHttp.listen(this.#puerto, () => {
			this.#log.info(`Servidor WebSocket a la escucha en el puerto ${this.#puerto}`);
		});

		this.#servidorWs = new WebSocketServer({
			httpServer: this.#servidorHttp,
			autoAcceptConnections: false
		});

		this.#servidorWs.on('request', (request) => {
			// Buscamos un slot libre en el array de clientes
			let idCliente = this.#clientes.findIndex(e => e === null);
			if (idCliente === -1) idCliente = this.#clientes.length;

			let cliente = new ConexionWebSocket(idCliente, this, request);
			this.#clientes[idCliente] = (cliente);
		});
	}

	suscribirCliente(canal, idCliente) {
		if (!this.#canales[canal]) this.#canales[canal] = [idCliente]
		else this.#canales[canal].push(idCliente);
	}

	desuscribirCliente(canal, idCliente) {
		let indice = this.#canales[canal].indexOf(idCliente);
		if (indice >= 0) {
			this.#canales[canal].splice(indice, 1)
		}
	}

	desconectarCliente(idCliente) {
		this.#clientes[idCliente] = null;
		console.log(this.#clientes)
	}

	enviarMensaje(canal, mensaje) {
		this.#canales[canal]?.forEach(idCliente => {
			let cliente = this.#clientes[idCliente];
			if (cliente) cliente.enviarMensaje(mensaje)
		})
	}




}

class ConexionWebSocket {

	#idConexion;
	#log;
	#conexion;
	#servidor;
	#suscripciones = [];

	constructor(id, padre, req) {
		this.#idConexion = id;
		this.#servidor = padre;
		this.#log = L.instanciar({ txId: 'WebSocketCon#' + id })
		this.#conexion = req.accept();

		this.#log.info(`Aceptada conexión entrante con ID ${this.#idConexion} desde ${this.#conexion.remoteAddress}`);

		this.#conexion.on('message', (a) => this.#onMensajeEntrante(a));
		this.#conexion.on('close', (a, b) => this.#onConexionCerrada(a, b));
	}

	#onMensajeEntrante(mensaje) {
		try {
			if (mensaje.type === 'utf8') {
				let json = JSON.parse(mensaje.utf8Data);
				this.#log.trace('Recibido mensaje', json);

				switch (json.accion) {
					case 'suscribir': this.suscribir(json); return;
					case 'desuscribir': this.desuscribir(json); return;
					default: this.enviarMensaje({ ok: false, mensaje: `Acción desconocida: '${json.accion}'` }); return;
				}

			} else {
				this.#log.warn('Recibido mensaje binario que no se procesa');
			}
		} catch (error) {
			this.#log.warn('Recibido texto erroneo', error.message, mensaje.utf8Data)
		}
	}

	#onConexionCerrada(reasonCode, description) {
		this.#log.info(`Cliente ID ${this.#idConexion} desconectado. ${reasonCode}: ${description}`);
		this.#suscripciones.forEach(idCanal => {
			this.#servidor.desuscribirCliente(idCanal, this.#idConexion);
		})
		this.#servidor.desconectarCliente(this.#idConexion);
	}

	enviarMensaje(mensaje) {
		this.#conexion.sendUTF(JSON.stringify(mensaje));
	}

	suscribir(mensaje) {
		if (mensaje.canal) {
			let canal = K.CANALES.find(canal => canal.id === mensaje.canal)

			if (!canal) {
				this.enviarMensaje({
					ok: false,
					mensaje: `No existe el canal '${mensaje.canal}'`,
					suscripciones: this.#suscripciones
				})
				return;
			}

			if (this.#suscripciones.includes(canal.id)) {
				this.enviarMensaje({
					ok: true,
					mensaje: `Ya estaba suscrito al canal '${canal.id}'`,
					suscripciones: this.#suscripciones
				})
				return;
			}

			this.#suscripciones.push(canal.id);
			this.#servidor.suscribirCliente(canal.id, this.#idConexion);
			this.#log.info(`El usuario se suscribe al canal ${canal.id}`);
			this.enviarMensaje({
				ok: true,
				mensaje: `Suscrito al canal '${canal.id}'`,
				suscripciones: this.#suscripciones
			})

		} else {
			this.enviarMensaje({
				ok: false,
				mensaje: 'No se especifica el canal'
			})
		}
	}

	desuscribir(mensaje) {
		if (mensaje.canal) {

			let indice = this.#suscripciones.indexOf(mensaje.canal);

			if (indice > -1) {
				this.#log.info(`El usuario se desuscribe del canal ${mensaje.canal}`);
				this.#suscripciones.splice(indice, 1);
				this.#servidor.desuscribirCliente(mensaje.canal, this.#idConexion);

				this.enviarMensaje({
					ok: true,
					mensaje: `Se ha desuscrito del canal '${mensaje.canal}'`,
					suscripciones: this.#suscripciones
				})
				return;
			}

			this.enviarMensaje({
				ok: true,
				mensaje: `No estaba suscrito al canal '${mensaje.canal}'`,
				suscripciones: this.#suscripciones
			})

		} else {
			this.enviarMensaje({
				ok: false,
				mensaje: 'No se especifica el canal'
			})
		}
	}


}


module.exports = function (puerto) {
	return new Promise((accept, reject) => {
		accept(new ServidorWebSocket(puerto));
	})
}
