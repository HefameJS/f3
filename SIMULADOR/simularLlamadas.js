'use strict';
const L = global.L;
const axios = require('axios');

global.baseUrl = 'http://cpd25:5000'


module.exports = async () => {
	console.log('SIMULLLLL');

	let parametros = {
		method: 'POST',
		url: global.baseUrl + '/authenticate',
		body: {
			"user": "10107506@hefame",
			"password": "12345678"
		}
	};

	console.log(parametros);

	let respuestaSap = await axios(parametros);

	console.log(respuestaSap);


}