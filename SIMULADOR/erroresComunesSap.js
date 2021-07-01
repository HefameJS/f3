'use strict';


module.exports = (req, res) => {

	let modo = global.modo;

	switch (modo) {
		case 'error cabeceras':
			res.status(400).send('');
			return true;

		case 'timeout':
			L.info('Dando lugar a un timeout ....');
			return true;

		case 'no entendible':
			res.status(200).send('asdas{dasd}dasda}a');
			return true;

		case '400':
		case '401':
		case '403':
		case '404':
		case '500':
		case '501':
		case '503':
			res.status(parseInt(modo)).json({});
			return true;
	}

	return false;

}