const L = global.L;
const C = global.C;
let WebSocket = require('ws').WebSocket;

class ClienteWebsocketInterior {

	#intervaloReconexion;
	#numeroEntradasBuffer;
	#buffer;
	

	#timeoutConexion;
	#websocket;
	#log;

	constructor() {
		this.#log = L.instanciar('wsCliente', 'WebSocket');
		this.#buffer = require('global/extensiones/fifo')();

		this.#intervaloReconexion = C.monitor.websocket.clienteWorker.intervaloReconexion;
		this.#numeroEntradasBuffer = C.monitor.websocket.clienteWorker.numeroEntradasBuffer;

		this.#conectarConServidor();
	}

	#conectarConServidor() {

		if (this.#websocket) this.#websocket.terminate();



		this.#log.info('Estableciendo conexión con el servicio de recolección de eventos');
		this.#websocket = new WebSocket(C.monitor.getUrlWebsocketColector());

		this.#websocket.on('error', (error) => {
			this.#log.warn('Error conexión al servicio de recolección', error.message);
		});

		this.#websocket.on('close', (codigo) => {
			this.#log.warn(`Se ha cerrado la conexión con el servidor. [codigo=${codigo}]`);
			this.#log.debug(`Se reintenta la conexión en ${this.#intervaloReconexion}ms`);
			this.#timeoutConexion = setTimeout(() => this.#conectarConServidor(), this.#intervaloReconexion);
		});

		this.#websocket.on('open', () => {
			this.#log.info('Conexión con el servicio establecida');
			clearTimeout(this.#timeoutConexion);
			this.#limpiarBuffer();
		});

		this.#websocket.on('message', function (mensaje) {
			this.#log.trace("Recibido desde el colector: '" + mensaje + "'");
		});

	}

	enviarMensaje(mensaje, envioDesdeBuffer) {
		// this.#log.trace('Enviando mensaje al recolector', mensaje)

		if (!this.#websocket) {
			this.#log.trace('No existe la conexión al recolector')
			if (!envioDesdeBuffer) this.#insertarEnBuffer(mensaje);
			return;
		}
		else {
			if (this.#websocket.readyState === WebSocket.OPEN) {
				this.#websocket.send(JSON.stringify(mensaje), { binary: false },);
			} else {
				this.#log.trace(`La conexión está en un estado no válido [readyState=${this.#websocket.readyState}]`)
				if (!envioDesdeBuffer) this.#insertarEnBuffer(mensaje);
			}
		}
	}

	#insertarEnBuffer(mensaje) {
		this.#buffer.push(mensaje);
		if (this.#buffer.length > this.#numeroEntradasBuffer) {
			this.#buffer.shift();
		}
	}

	#limpiarBuffer() {
		let mensaje;
		while (mensaje = this.#buffer.shift()) {
			this.enviarMensaje(mensaje);
		}
	}

}

module.exports = ClienteWebsocketInterior;
