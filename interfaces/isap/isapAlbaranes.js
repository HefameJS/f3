'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;


const NO_SAP_SYSTEM_ERROR = {
	type: K.ISAP.ERROR_TYPE_NO_SAPSYSTEM,
	errno: null,
	code: 'No se encuentra definido el sistema SAP destino'
}

const SapSystem = require(BASE + 'model/sapsystem');
const request = require('request');


exports.consultaAlbaranJSON = (txId, numeroAlbaran, callback) => {

	let sapSystemData = C.getDefaultSapSystem();
	if (!sapSystemData) {
		callback(NO_SAP_SYSTEM_ERROR, null);
		return;
	}
	let sapSystem = new SapSystem(sapSystemData);
	let httpCallParams = sapSystem.getRequestCallParams({
		path: '/api/zsd_orderlist_api/view/' + numeroAlbaran,
		method: 'GET'
	});

	L.xd(txId, ['Enviando a SAP consulta de albarán', httpCallParams]);

	request(httpCallParams, function (err, res, body) {

		if (err) {
			callback(err, res, body);
			return;
		}

		let statusCodeType = Math.floor(res.statusCode / 100);
		if (statusCodeType === 2) {
			callback(null, res, body);
		} else {
			callback({
				errno: res.statusCode,
				code: res.statusMessage
			}, res, body);
		}

	});
}

exports.consultaAlbaranPDF = function (txId, numeroAlbaran, callback) {

	let sapSystemData = C.getDefaultSapSystem();
	if (!sapSystemData) {
		callback(NO_SAP_SYSTEM_ERROR, null);
		return;
	}
	let sapSystem = new SapSystem(sapSystemData);
	let httpCallParams = sapSystem.getRequestCallParams({
		path: '/api/zsf_get_document/proforma/' + numeroAlbaran,
		method: 'GET'
	});

	L.xd(txId, ['Enviando a SAP consulta de albarán PDF', httpCallParams]);

	request(httpCallParams, function (err, res, body) {

		if (err) {
			callback(err, res, body);
			return;
		}

		var statusCodeType = Math.floor(res.statusCode / 100);
		if (statusCodeType === 2) {
			callback(null, res, body);
		} else {
			callback({
				errno: res.statusCode,
				code: res.statusMessage
			}, res, body);
		}

	});
}

exports.listadoAlbaranes = (txId, consultaAlbaran, callback) => {

	let sapSystemData = C.getDefaultSapSystem();
	if (!sapSystemData) {
		callback(NO_SAP_SYSTEM_ERROR, null);
		return;
	}
	let sapSystem = new SapSystem(sapSystemData);
	let httpCallParams = sapSystem.getRequestCallParams({
		path: '/api/zsd_orderlist_api/query/?query=' + consultaAlbaran.toQueryString(),
		method: 'GET'
	});

	L.xd(txId, ['Enviando a SAP consulta de listado de albaranes', httpCallParams]);

	request(httpCallParams, function (err, res, body) {

		if (err) {
			callback(err, res, body);
			return;
		}

		let statusCodeType = Math.floor(res.statusCode / 100);
		if (statusCodeType === 2) {
			callback(null, res, body);
		} else {
			callback({
				errno: res.statusCode,
				code: res.statusMessage
			}, res, body);
		}

	});
}
