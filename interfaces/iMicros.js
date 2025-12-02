'use strict';

const C = global.config;
const L = global.logger;
//const K = global.constants;

const ErrorFedicom = require("modelos/ErrorFedicom");
const { default: axios } = require("axios");


const tratarError = (txId, error, descricpion, codigo, mensaje, estadoHttp) => {
	if (error.response) {
		const data = error.response.data;
		L.xw(txId, ["La llamada al microservicio [" + descricpion + "] devolvió un error HTTP", error.response.status, data]);
		if (Array.isArray(data) && data.length) {
			return new ErrorFedicom(
				data[0].codigo,
				data[0].descripcion,
				error.response.status
			)
		}
	} else {
		L.xw(txId, ["No se pudo conectar con el microservicio [" + descricpion + "]", error.message]);
		return new ErrorFedicom(codigo, mensaje, estadoHttp)
	}
}

const autenticar = async function (solicitudAutenticacion) {

	try {
		let respuesta = await axios({
			url: C.microservicios.autenticacion.endpoint,
			method: "POST",
			data: {
				user: solicitudAutenticacion.usuario,
				password: solicitudAutenticacion.clave
			}
		});

		return respuesta.data;

	} catch (error) {

		const txId = solicitudAutenticacion.txId;
		return tratarError(txId, error, "autenticacion", "AUTH-005", "Error al verificar las credenciales", 503);

	}

}

const albaran = async function (req, res) {

	let txId = req.txId;

	let numAlbaran = req.params.numeroAlbaran;
	if (!numAlbaran) {
		let errorFedicom = new ErrorFedicom('ALB-ERR-003', 'El parámetro "numeroAlbaran" es obligatorio', 400);
		errorFedicom.enviarRespuestaDeError(res);
		return;
	}
	let numAlbaranSaneado = numAlbaran.padStart(10, '0');

	let formatoAlbaran;
	if (req.headers['accept']) {
		switch (req.headers['accept'].toLowerCase()) {
			case 'application/pdf': formatoAlbaran = 'application/pdf'; break;
			default: formatoAlbaran = 'application/json'; break;
		}
	}

	L.xi(txId, ['El albarán solicitado', numAlbaranSaneado, formatoAlbaran])
	const authHeader = req.headers['authorization'];
	const url = C.microservicios.albaranes.endpoint.replace("{idAlbaran}", numAlbaran);

	try {
		let respuesta = await axios({
			url,
			method: "GET",
			headers: {
				Accept: formatoAlbaran,
				Authorization: authHeader
			},
			responseType: formatoAlbaran.toUpperCase() === "application/pdf" ? "stream" : "json",
			responseEncoding: 'latin1'
		});

		if (formatoAlbaran === "application/pdf") {
			res.setHeader("Content-Type", respuesta.headers['content-type']);
			res.setHeader("Content-Disposition", `attachment; filename=${numAlbaranSaneado}.pdf`);
			res.send(Buffer.from(respuesta.data, "binary"));
		} else {
			res.json(respuesta.data);
		}

	} catch (error) {
		if (error.response) {
			res.status(error.response.status)
			res.setHeader("Content-Type", error.response.headers['content-type']);
			if (error.response.headers['content-disposition'])
				res.setHeader("Content-Disposition", error.response.headers['content-disposition']);
			res.send(error.response.data);
			return;
		}

		let errorFedicom = tratarError(txId, error, "albaran", "ALB-ERR-999", "Error al obtener los datos del albarán", 503);
		errorFedicom.enviarRespuestaDeError(res);
	}

}

module.exports = {
	autenticar,
	albaran
}

