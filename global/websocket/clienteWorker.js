
let WebSocketClient = require('websocket').client;

class ClienteWorker {
	#cliente;
	#conexion;

	constructor() {
		this.#cliente = new WebSocketClient();

		this.#cliente.on('connectFailed', (error) => {
			console.log('Connect Error: ' + error.toString());
		});

		this.#cliente.on('connect', (connection) => {
			this.#conexion = connection;
			console.log('WebSocket Client Connected');

			connection.on('error', function (error) {
				console.log("Connection Error: " + error.toString());
			});
			connection.on('close', function () {
				console.log('echo-protocol Connection Closed');
			});
			connection.on('message', function (message) {
				if (message.type === 'utf8') {
					console.log("Received: '" + message.utf8Data + "'");
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
