const M = global.M;
const L = global.L;


class MaestroTransfers {

	#transfers = [];

	async cargarTransfers() {
		try {
			let respuesta = await M.col.maestros.findOne({ '_id': 'transfers' })
			if (respuesta?.transfers) {
				this.#transfers = Object.keys(respuesta.transfers).map(idTransfer => {
					return {
						id: idTransfer,
						nombre: respuesta.transfers[idTransfer]
					}
				})
				L.debug('Maestro de transfers cargado con éxito');
			} else {
				L.warn('La consulta al maestro de transfers no ha devuelto transfers', respuesta);
			}
		}
		catch (error) {
			L.err('Ocurrió una excepción al obtener el maestro de transfers', error);
		}
	}

	async lista() {
		if (!this.#transfers.length) await this.cargarTransfers();
		return this.#transfers;
	}

	async porNombre(codigoTransfer) {
		if (!this.#transfers.length) await this.cargarTransfers();
		let transfer = this.#transfers.find(objTransfer => objTransfer.id === codigoTransfer)
		if (transfer) return transfer;
		return { id: 'X', nombre: 'Transfer desconocido' };
	}

}

module.exports = MaestroTransfers;