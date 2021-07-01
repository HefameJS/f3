'use strict';



module.exports = (app) => {

	// Middleware que se ejecuta antes de buscar la ruta correspondiente.
	// Detecta errores comunes en las peticiones entrantes tales como:
	//  - Errores en el parseo del JSON entrante.
	app.use(async (errorExpress, req, res, next) => {

		if (errorExpress) {
			res.status(400).send({})
		}
		else {
			next();
		}

	});



	// Rutas estandard Fedicom v3
	app.route('/api/zverify_fedi_credentials')
		.post(require('./simuladorAutenticacion').post);



	// Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta.
	app.use(async (req, res) => {
		res.status(404).send({})
	});

};
