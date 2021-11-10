const MaestroAlmacenes = require("./MaestroAlmacenes");
const MaestroEstados = require("./MaestroEstados");
const MaestroLaboratorios = require("./MaestroLaboratorios");
const MaestroProgramas = require("./MaestroProgramas");
const MaestroTipos = require("./MaestroTipos");
const MaestroTransfers = require("./MaestroTransfers");

class Maestro {

	static almacenes = new MaestroAlmacenes();
	static laboratorios = new MaestroLaboratorios();
	static transfers = new MaestroTransfers();
	static programas = new MaestroProgramas();
	static estados = new MaestroEstados();
	static tipos = new MaestroTipos();

	static async cachearMaestros() {
		let r = await Promise.allSettled([
			Maestro.almacenes.cargarAlmacenes(),
			Maestro.laboratorios.cargarLaboratorios(),
			Maestro.transfers.cargarTransfers(),
			Maestro.programas.cargarProgramas(),
			Maestro.estados.cargarEstados(),
			Maestro.tipos.cargarTipos()
		]);

		L.debug('Se han cacheado los maestros', r)
	}
}


module.exports = Maestro;