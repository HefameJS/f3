const M = global.M;
const L = global.L;


class MaestroEstados {

	#estados = [];

	async cargarEstados() {
		try {
			let respuesta = await M.col.maestros.findOne({ '_id': 'estados' })
			if (respuesta?.estados) {
				this.#estados = Object.keys(respuesta.estados).map(codigoEstado => {
					let datosDelEstado = respuesta.estados[codigoEstado];
					return {
						codigo: datosDelEstado.codigo,
						ambito: datosDelEstado.ambito,
						nombre: datosDelEstado.nombre,
						descripcion: datosDelEstado.descripcion,
						color: datosDelEstado.color,
					}
				})
				L.debug('Maestro de estados cargado con éxito');
			} else {
				L.warn('La consulta al maestro de estados no ha devuelto estados', respuesta);
			}
		}
		catch (error) {
			L.err('Ocurrió una excepción al obtener el maestro de estados', error);
		}
	}

	async lista() {
		if (!this.#estados.length) await this.cargarEstados();
		return this.#estados;
	}

	async porNombre(codigoEstado) {
		if (!this.#estados.length) await this.cargarEstados();
		let estado = this.#estados.find(objEstado => objEstado.codigo === parseInt(codigoEstado))
		if (estado) return estado;
		return {
			codigo: 0,
			ambito: null,
			nombre: 'DESCONOCIDO',
			descripcion: 'No se conoce el estado',
			color: 'warning',
		}
	}

}

module.exports = MaestroEstados;