

const ServidorWebSocketColector = require('global/websocket/websocketColector');
const ServidorWebSocketConcentrador = require('global/websocket/websocketConcentrador');
let clienteWorker = null; ;


module.exports = {
	arrancarServicioColector: function (puerto) {
		return new Promise((accept, reject) => {
			accept(new ServidorWebSocketColector(puerto));
		})
	},
	/*enviarMensajeAColector: function(mensaje) {
		ClienteWorker
	},*/
	arrancarServicioConcentrador: (puerto) => {
		return new Promise((accept, reject) => {
			accept(new ServidorWebSocketConcentrador(puerto));
		})
	},
	enviarMensajeAColector: async (mensaje) => {
		if (!clienteWorker) {
			clienteWorker = await require('global/websocket/clienteWorker')();
		}
		clienteWorker.enviarMensaje(mensaje)
	}

	
};
