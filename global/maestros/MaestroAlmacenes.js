'use strict';
const M = global.M;
const L = global.L;


class MaestroAlmacenes {

	#almacenes = [];

	async cargarAlmacenes() {
		try {
			let respuesta = await M.col.maestros.findOne({ '_id': 'almacenes' })
			if (respuesta?.almacenes) {
				this.#almacenes = Object.keys(respuesta.almacenes).map(idAlmacen => {
					return {
						id: idAlmacen,
						nombre: respuesta.almacenes[idAlmacen]
					}
				})
				L.debug('Maestro de almacenes cargado con éxito');
			} else {
				L.warn('La consulta al maestro de almacenes no ha devuelto almacenes', respuesta);
			}
		}
		catch (error) {
			L.err('Ocurrió una excepción al obtener el maestro de almacenes', error);
		}
		return ({ maestro: 'Almacen', cargados: this.#almacenes.length })
	}

	async lista() {
		if (!this.#almacenes.length) await this.cargarAlmacenes();
		return this.#almacenes;
	}

	async porNombre(codigoAlmacen) {
		if (!this.#almacenes.length) await this.cargarAlmacenes();
		let almacen = this.#almacenes.find(objAlmacen => objAlmacen.id === codigoAlmacen)
		if (almacen) return almacen;
		return { id: 'X', nombre: 'Almacén desconocido' };
	}

	getNombreSync(codigoAlmacen) {
		if (!this.#almacenes.length) return codigoAlmacen;
		let almacen = this.#almacenes.find(objAlmacen => objAlmacen.id === codigoAlmacen)
		return almacen?.nombre || codigoAlmacen;
	}

}

module.exports = MaestroAlmacenes;