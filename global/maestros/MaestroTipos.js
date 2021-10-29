const M = global.M;
const L = global.L;


class MaestroTipos {

	#tipos = [];

	async cargarTipos() {
		try {
			let respuesta = await M.col.maestros.findOne({ '_id': 'tipos' })
			if (respuesta?.tipos) {
				this.#tipos = Object.keys(respuesta.tipos).map(codigoTipo => {
					let datosDelTipo = respuesta.tipos[codigoTipo];
					return {
						codigo: datosDelTipo.codigo,
						nombre: datosDelTipo.nombre,
						descripcion: datosDelTipo.descripcion,
						color: datosDelTipo.color,
						grupo: datosDelTipo.grupo,
					}
				})
				L.debug('Maestro de tipos cargado con éxito');
			} else {
				L.warn('La consulta al maestro de tipos no ha devuelto tipos', respuesta);
			}
		}
		catch (error) {
			L.err('Ocurrió una excepción al obtener el maestro de tipos', error);
		}
	}

	async lista() {
		if (!this.#tipos.length) await this.cargarTipos();
		return this.#tipos;
	}

	async porNombre(codigoTipo) {
		if (!this.#tipos.length) await this.cargarTipos();
		let tipo = this.#tipos.find(objTipo => objTipo.codigo === parseInt(codigoTipo))
		if (tipo) return tipo;
		return {
			codigo: 0,
			nombre: 'DESCONOCIDO',
			descripcion: 'No se conoce el tipo',
			color: 'warning',
			grupo: "ERROR"
		}
	}

}

module.exports = MaestroTipos;