const MaestroAlmacenes = require("./MaestroAlmacenes");
const MaestroLaboratorios = require("./MaestroLaboratorios");
const MaestroProgramas = require("./MaestroProgramas");
const MaestroTransfers = require("./MaestroTransfers");

class Maestro {
	static almacenes = new MaestroAlmacenes();
	static laboratorios = new MaestroLaboratorios();
	static transfers = new MaestroTransfers();
	static programas = new MaestroProgramas();
}

module.exports = Maestro;