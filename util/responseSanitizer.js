
const removeCab = [ 'login', 'crc' ];
const removePos = [ 'posicion_sap' ];

const replaceCab = [ 'numeroPedido', 'codigoCliente', 'direccionEnvio', 'numeroPedidoOrigen', 'tipoPedido', 'codigoAlmacenServicio', 'fechaPedido', 'fechaServicio', 'cargoCooperativo', 'empresaFacturadora' ];
const replacePos = [ 'codigoArticulo', 'codigoUbicacion', 'codigoArticuloSustituyente', 'cantidadFalta', 'cantidadBonificacion', 'cantidadBonificacionFalta', 'descuentoPorcentaje', 'descuentoImporte', 'cargoPorcentaje', 'cargoImporte', 'valeEstupefacientes', 'fechaLimiteServicio', 'servicioDemorado', 'estadoServicio', 'servicioAplazado' ];



module.exports = function(message) {

	removeCab.forEach( function (field) {
		delete message[field];
	});

	replaceCab.forEach( function (field) {
		var fieldLowerCase = field.toLowerCase();
		if (message[fieldLowerCase] !== undefined) {
			message[field] = message[fieldLowerCase];
			delete message[fieldLowerCase];
		}
	});

	if (message.lineas) {

		message.lineas.forEach( function (linea) {
			removePos.forEach( function (field) {
				delete linea[field];
			});

			replacePos.forEach( function (field) {
				var fieldLowerCase = field.toLowerCase();
				if (linea[fieldLowerCase] !== undefined) {
					linea[field] = linea[fieldLowerCase];
					delete linea[fieldLowerCase];
				}
			});
		});
	}

	return message;

}
