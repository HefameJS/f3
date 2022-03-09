const L = global.L;
const WebSocketServer = require('ws').WebSocketServer;

class ServidorWebSocketExterior {

	#puerto;
	#log;
	#servidorWs;

	#clientes = [];
	#numeroMaximoConexiones;


	constructor() {

		this.#puerto = C.monitor.websocket.exterior.puerto;
		this.#numeroMaximoConexiones = C.monitor.websocket.exterior.numeroMaximoConexiones;
		this.#log = L.instanciar('wsExterior', 'WebSocket');


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
			this.#log.err('Error en el servicio', error);
		});

		this.#servidorWs.on('connection', (websocket, request) => {
			
			this.#log.info(`Petición de cliente entrante desde ${request.socket.remoteAddress}`)

			for (let i = 0; i < this.#numeroMaximoConexiones; i++) {
				if (!this.#clientes[i]) {
					this.#clientes[i] = new ClienteWebsocketExterno(i, this, websocket, request);;
					return;
				}
			}

			this.#log.warn(`No se acepta la conexión porque se ha alcanzado el límite de conexiones`)

		});
	}


	desconectarCliente(idWorker) {
		this.#clientes[idWorker] = null;
	}


}


class ClienteWebsocketExterno {

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

		this.#log = L.instanciar('wsExterno_' + idWorker, 'WebSocket')

		this.#log.info(`Aceptada conexión entrante en ${this.#socket.localAddress} desde ${this.#socket.remoteAddress}`);

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
		this.#log.info(`Cliente desconectado. ${reasonCode}: ${description}`);
		this.#servidor.desconectarCliente(this.#idConexion);
	}

}


module.exports = ServidorWebSocketExterior;