'use strict';

module.exports.post = async(req, res) => {

	if (require('./erroresComunesSap')()) {
		return;
	}

	let modo = global.modo || 'usuario ok';

	switch (modo) {
		case 'usuario ok':
			res.status(200).json({
				username: '10107506@hefame'
			});
			return;
		case 'auth-5':
			res.status(200).json([
				{
					"codigo": "AUTH-05",
					"descripcion": "Usuario o contraseña incorrectos"
				}
			]);
			return;
		case 'auth-3':
			res.status(200).json([
				{
					"codigo": "AUTH-03",
					"descripcion": "El parámetro usuario es obligatorio"
				}
			]);
			return;
		case 'auth-4':
			res.status(200).json([
				{
					"codigo": "AUTH-04",
					"descripcion": "El parámetro password es obligatorio"
				}
			]);
			return;
		case 'auth-3+4':
			res.status(200).json([
				{
					"codigo": "AUTH-03",
					"descripcion": "El parámetro usuario es obligatorio"
				},
				{
					"codigo": "AUTH-04",
					"descripcion": "El parámetro password es obligatorio"
				}
			]);
			return;
		
	}



}
