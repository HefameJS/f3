const M = global.M;
const L = global.L;


class MaestroProgramas {

	#programas = [];

	async cargarProgramas() {
		try {
			let respuesta = await M.col.maestros.findOne({ '_id': 'programas' })
			if (respuesta?.programas) {
				this.#programas = Object.keys(respuesta.programas).map(idPrograma => {
					return {
						id: parseInt(idPrograma),
						nombre: respuesta.programas[idPrograma]
					}
				})
				L.debug('Maestro de programas cargado con éxito');
			} else {
				L.warn('La consulta al maestro de programas no ha devuelto programas', respuesta);
			}
		}
		catch (error) {
			L.err('Ocurrió una excepción al obtener el maestro de programas', error);
		}
		return ({ maestro: 'Programa', cargados: this.#programas.length })
	}

	async lista() {
		if (!this.#programas.length) await this.cargarProgramas();
		return this.#programas;
	}

	async porNombre(codigoPrograma) {
		codigoPrograma = parseInt(codigoPrograma);
		if (!this.#programas.length) await this.cargarProgramas();
		let programa = this.#programas.find(objPrograma => objPrograma.id === codigoPrograma)
		if (programa) return programa;
		return { id: -1, nombre: codigoPrograma + ' Desconocido' };
	}

}

module.exports = MaestroProgramas;