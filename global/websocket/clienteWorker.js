
let WebSocketClient = require('websocket').client;

class ClienteWorker {
	#cliente;
	#conexion;
	#log;

	constructor() {
		this.#log = L.instanciar({ txId: 'WSWorker' });
		this.#conectarConServidor();
	}

	#conectarConServidor() {
		this.#cliente = new WebSocketClient();

		this.#cliente.on('connectFailed', (error) => {
			this.#log.error('Connect Error: ' + error.toString());
		});

		this.#cliente.on('connect', (connection) => {
			this.#conexion = connection;
			this.#log.info('Conectado al servidor de recolección');

			connection.on('error', function (error) {
				this.#log.error("Connection Error: " + error.toString());
			});
			connection.on('close', function () {
				this.#log.info('echo-protocol Connection Closed');
			});
			connection.on('message', function (message) {
				if (message.type === 'utf8') {
					this.#log.trace("Recibido desde el colector: '" + message.utf8Data + "'");
				}
			});
		});

		this.#cliente.connect('ws://localhost:5002/asd-33');
	}

	enviarMensaje(mensaje) {
		if (this.#conexion?.connected) {
			this.#conexion.sendUTF(JSON.stringify(mensaje));
		}
	}
}

module.exports = () => Promise.resolve(new ClienteWorker()) ;
