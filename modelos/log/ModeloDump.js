'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Externas
const OS = require('os');
const FS = require('fs');

class Dump {

	constructor(nombreFicheroDump) {

		let servidor = null;

		if (nombreFicheroDump.indexOf('@') > 0) {
			let trozosNombre = nombreFicheroDump.split('@', 2);
			servidor = trozosNombre[0]
			nombreFicheroDump = trozosNombre[1];
		} else {
			servidor = OS.hostname();
		}

		this.id = servidor + '@' + nombreFicheroDump;
		this.servidor = servidor;
		this.fichero = nombreFicheroDump;
		this.hora = nombreFicheroDump.substring(0, 19);
		let idProceso = nombreFicheroDump.substring(20, nombreFicheroDump.length - 5);

		let separacionPid = idProceso.lastIndexOf('-');
		this.tipoProceso = idProceso.substring(0, separacionPid);
		this.pid = parseInt(idProceso.substring(separacionPid + 1));

		if (this.tipoProceso.startsWith('f3-' + K.PROCESS_TYPES.CORE_WORKER)) {
			let separacionWid = this.tipoProceso.lastIndexOf('-');
			this.workerId = parseInt(this.tipoProceso.substring(separacionWid + 1));
			this.tipoProceso = this.tipoProceso.substring(0, separacionWid);
		}
	}

	/**
	 * Lee el contenido del fichero de dump y lo adjunta al objeto en el campo 'contenido'.
	 * Tambien lo devuelve en la llamada al callback.
	 */
	leerContenidoFichero(callback) {

		L.i(['Consultando el contenido del fichero local']);
		FS.readFile(C.logdir + '/' + this.fichero, (error, contenido) => {
			if (error) {
				callback(error);
				this.contenido = null;
				return;
			}
			this.contenido = contenido.toString();
			callback(null, contenido);
		})
		
	}

}


Dump.listadoDumpsLocales = (callback) => {

	FS.readdir(C.logdir, (errorFs, ficheros) => {
		if (errorFs) {
			callback(errorFs, null);
			return;
		}

		let dumps = [];
		ficheros.forEach(fichero => {
			if (fichero.endsWith('.dump')) {
				dumps.push(new Dump(fichero));
			}
		});
		callback(null, dumps);
	});

}



module.exports = Dump;

