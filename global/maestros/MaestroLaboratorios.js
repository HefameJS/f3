const M = global.M;
const L = global.L;


class MaestroLaboratorios {

	#laboratorios = [];

	async cargarLaboratorios() {
		try {
			let respuesta = await M.col.maestros.findOne({ '_id': 'laboratorios' })
			if (respuesta?.laboratorios) {
				this.#laboratorios = Object.keys(respuesta.laboratorios).map(idLaboratorio => {
					return {
						id: parseInt(idLaboratorio),
						nombre: respuesta.laboratorios[idLaboratorio]
					}
				})
				L.debug('Maestro de laboratorios cargado con éxito');
			} else {
				L.warn('La consulta al maestro de laboratorios no ha devuelto laboratorios', respuesta);
			}
		}
		catch (error) {
			L.err('Ocurrió una excepción al obtener el maestro de laboratorios', error);
		}
		return ({ maestro: 'Lab', cargados: this.#laboratorios.length })
	}

	async lista() {
		if (!this.#laboratorios.length) await this.cargarLaboratorios();
		return this.#laboratorios;
	}

	async porNombre(codigoLaboratorio) {
		if (!this.#laboratorios.length) await this.cargarLaboratorios();
		codigoLaboratorio = parseInt(codigoLaboratorio);
		let laboratorio = this.#laboratorios.find(objLaboratorio => objLaboratorio.id === codigoLaboratorio)
		if (laboratorio) return laboratorio;
		return { id: 0, nombre: 'Laboratorio desconocido' };
	}

}

module.exports = MaestroLaboratorios;