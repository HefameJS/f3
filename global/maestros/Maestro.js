const MaestroAlmacenes = require("./MaestroAlmacenes");
const MaestroEstados = require("./MaestroEstados");
const MaestroLaboratorios = require("./MaestroLaboratorios");
const MaestroProgramas = require("./MaestroProgramas");
const MaestroTransfers = require("./MaestroTransfers");

class Maestro {
	static almacenes = new MaestroAlmacenes();
	static laboratorios = new MaestroLaboratorios();
	static transfers = new MaestroTransfers();
	static programas = new MaestroProgramas();
	static estados = new MaestroEstados();
}

module.exports = Maestro;