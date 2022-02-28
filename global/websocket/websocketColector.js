const L = global.L;
const K = global.K;

const WebSocketServer = require('websocket').server;
const http = require('http');


class ServidorWebSocketColector {

	#puerto;
	#log;
	#servidorHttp;
	#servidorWs;

	#clientes = {};

	constructor(puerto) {

		this.#puerto = puerto;
		this.#log = L.instanciar({ txId: 'WSColector' });

		this.#servidorHttp = http.createServer((request, response) => {
			response.writeHead(404);
			response.end();
		});

		this.#servidorHttp.listen(this.#puerto, () => {
			this.#log.info(`Servidor WebSocket Colector a la escucha en el puerto ${this.#puerto}`);
		});

		this.#servidorWs = new WebSocketServer({
			httpServer: this.#servidorHttp,
			autoAcceptConnections: false
		});

		this.#servidorWs.on('request', (request) => {
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
			
			let cliente = new ConexionWorker(idWorker, this, request);
			this.#clientes[idWorker.toString()] = cliente;
		});
	}


	desconectarCliente(idWorker) {
		delete this.#clientes[idWorker.toString()];
		console.log(this.#clientes)
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
		let recurso = request.resource;
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
		return this.servidor + ':' + this.pid;
	}
}


class ConexionWorker {

	#idConexion;
	#log;
	#conexion;
	#servidor;

	constructor(idWorker, padre, req) {
		this.#idConexion = idWorker;
		this.#servidor = padre;
		this.#log = L.instanciar({ txId: 'WebSocketCon#' + idWorker })
		this.#conexion = req.accept();

		this.#log.info(`Aceptada conexión entrante con ID ${idWorker} desde ${this.#conexion.remoteAddress}`);

		this.#conexion.on('message', (a) => this.#onMensajeEntrante(a));
		this.#conexion.on('close', (a, b) => this.#onConexionCerrada(a, b));
	}

	desconectar() {
		this.enviarMensaje({accion: 'desconectar'});
		this.#conexion.close(1000);
	}

	enviarMensaje(mensaje) {
		this.#conexion.sendUTF(JSON.stringify(mensaje));
	}

	#onMensajeEntrante(mensaje) {
		try {
			if (mensaje.type === 'utf8') {
				let json = JSON.parse(mensaje.utf8Data);
				this.#log.trace('Recibido mensaje', json);

				switch (json.accion) {
					case 'suscribir': this.suscribir(json); return;
					case 'desuscribir': this.desuscribir(json); return;
					default: return; //No-Op
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
		this.#servidor.desconectarCliente(this.#idConexion);
	}

}




module.exports = ServidorWebSocketColector;