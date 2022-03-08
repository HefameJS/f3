const L = global.L;
const WebSocketServer = require('ws').WebSocketServer;

class ServidorWebSocketInterior {

	#puerto;
	#log;
	#servidorWs;

	#clientes = {};

	constructor() {

		this.#puerto = C.monitor.websocket.interior.puerto;
		this.#log = L.instanciar('wsInterno', 'WebSocket');

		this.#servidorWs = new WebSocketServer({
			port: this.#puerto,
			clientTracking: false
		});

		this.#servidorWs.on('listening', () => {
			this.#log.info('Servicio a la escucha', this.#servidorWs.address());
		});

		this.#servidorWs.on('close', () => {
			this.#log.info('Servicio cerrado');
		});

		this.#servidorWs.on('error', (error) => {
			this.#log.error('Error en el servicio', error);
		});

		this.#servidorWs.on('connection', (websocket, request) => {
			let idWorker = IdentificadorWorker.desdeRequest(request);

			this.#log.info(`Petición de worker entrante desde ${request.host} con identificador ${idWorker}`)

			if (!idWorker) {
				this.#log.warn(`Se rechaza la petición por no indicar identificador de worker`)
				request.reject(400);
				return;
			}

			if (this.#clientes[idWorker.toString()]) {
				this.#log.warn(`Ya existe un cliente con el mismo ID. Desconectamos el más antiguo`)
				this.#clientes[idWorker.toString()].desconectar()
			}

			let cliente = new ClienteWebsocketInterno(idWorker, this, websocket, request);
			this.#clientes[idWorker.toString()] = cliente;
		});
	}


	desconectarCliente(idWorker) {
		delete this.#clientes[idWorker.toString()];
	}


}

class IdentificadorWorker {
	servidor;
	pid;
	constructor(servidor, pid) {
		this.servidor = servidor;
		this.pid = pid;
	}

	static desdeRequest(request) {
		let recurso = request.url;
		let entreBarras = recurso.split('/');
		if (entreBarras[1]?.length) {
			let entreGuiones = entreBarras[1].split('-');
			if (entreGuiones[0]?.length && entreGuiones[1]?.length) {
				let servidor = entreGuiones[0];
				let pid = parseInt(entreGuiones[1]);
				if (servidor && pid) {
					return new IdentificadorWorker(servidor, pid)
				}
			}
		}
		return null;
	}

	toString() {
		return this.servidor + '-' + this.pid;
	}
}


class ClienteWebsocketInterno {

	#idConexion;
	#log;
	#websocket;
	#servidor;
	#socket;

	constructor(idWorker, servidor, websocket, request) {
		this.#idConexion = idWorker;
		this.#servidor = servidor;
		this.#websocket = websocket;
		this.#socket = request.socket;

		this.#log = L.instanciar('wsInterno_' + idWorker, 'WebSocket')

		this.#log.info(`Aceptada conexión entrante con ID ${idWorker} en ${this.#socket.localAddress} desde ${this.#socket.remoteAddress}`);

		this.#websocket.on('message', (a) => this.#onMensajeEntrante(a));
		this.#websocket.on('close', (a, b) => this.#onConexionCerrada(a, b));
	}

	desconectar() {
		this.enviarMensaje({ accion: 'desconectar' });
		this.#websocket.close(1000);
	}

	enviarMensaje(mensaje) {
		this.#websocket.sendUTF(JSON.stringify(mensaje));
	}

	#onMensajeEntrante(mensaje) {
		try {

			let json = JSON.parse(mensaje);
			this.#log.trace('Recibido mensaje', json);

			switch (json.accion) {
				case 'suscribir': this.suscribir(json); return;
				case 'desuscribir': this.desuscribir(json); return;
				default: return; //No-Op
			}

		} catch (error) {
			this.#log.warn('Recibido texto erroneo', error.message, mensaje)
		}
	}

	#onConexionCerrada(reasonCode, description) {
		this.#log.info(`Cliente ID ${this.#idConexion} desconectado. ${reasonCode}: ${description}`);
		this.#servidor.desconectarCliente(this.#idConexion);
	}

}


module.exports = ServidorWebSocketInterior;