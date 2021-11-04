'use strict';
const fs = require('fs/promises');
const SEPARADOR_DIRECTORIOS = require('path').sep;

const TransmisionLigera = require('modelos/transmision/TransmisionLigera');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const InterComunicador = require('interfaces/InterComunicador');
const ErrorFedicom = require('modelos/ErrorFedicom');





class TxMonConsultaDump extends TransmisionLigera {

	// @Override
	async operar() {

		let servidor = this.req.params?.servidor?.toLowerCase()
		let idDump = this.req.params?.idDump


		if (!servidor) {// Consulta general de todos los dumps del sistema
			this.log.info(`Solicitud del listado de Dumps del sistema`);
			try {
				let interComunicador = new InterComunicador(this);
				let respuesta = await interComunicador.llamadaTodosMonitores(`/~/dumps/local`)
				return new ResultadoTransmisionLigera(200, respuesta);
			} catch (errorLlamada) {
				return (new ErrorFedicom(errorLlamada, null, 400)).generarResultadoTransmision();
			}
		}
		else {

			if (servidor !== 'local' && servidor !== K.HOSTNAME) {
				this.log.info(`La solicitud es para el servidor ${servidor}. Redirigimos la petición al mismo`);
				try {
					let interComunicador = new InterComunicador(this);
					let respuesta = await interComunicador.llamadaMonitorRemoto(servidor, `/~/dumps/local${idDump ? '/' + idDump : ''}`)
					return new ResultadoTransmisionLigera(200, respuesta);
				} catch (errorLlamada) {
					return (new ErrorFedicom(errorLlamada, null, 400)).generarResultadoTransmision();
				}
			}

			if (idDump) {// Consulta de un DUMP en concreto
				this.log.info(`Solicitud del Dump [dump=${idDump}]`);
				let arbolDeDumps = await this.#generarArbolDeDumps({ incluirRutaCompleta: true });
				let dumpBuscado = this.#encontrarDumpEnArbol(arbolDeDumps, idDump);

				if (!dumpBuscado?.ruta) {
					return new ResultadoTransmisionLigera(404, new ErrorFedicom('HTTP-404', 'No se encuentra el Dump solicitado'));
				}

				let datosCompletosDump = await this.#generaInformacionDump(idDump, dumpBuscado.ruta, { incluirContenido: true })
				return new ResultadoTransmisionLigera(200, datosCompletosDump || null);
			} else { // Consulta de todos los dumps de un servidor
				this.log.info(`Solicitud del listado de Dumps de la instancia`);
				let arbolDeDumps = await this.#generarArbolDeDumps();
				return new ResultadoTransmisionLigera(200, arbolDeDumps || {});
			}
		}

	}

	async #leeContenidoDirectorio(directorio) {
		try {
			// Comprobamos que existe y es un directorio
			let metadatos = await fs.stat(directorio);
			if (!metadatos.isDirectory()) {
				this.log.warn(`Error al listar el directorio: El fichero '${directorio}' no es un directorio.`)
				return null;
			}
			return await fs.readdir(directorio);
		} catch (errorFs) {
			this.log.info(`Error al leer el directorio '${directorio}':`, errorFs);
			return null;
		}
	}

	async #generaInformacionDump(id, ruta, opciones) {
		let { incluirRutaCompleta, incluirContenido } = opciones;
		try {
			let metadatos = await fs.stat(ruta);

			let respuesta = {
				id,
				fecha: metadatos.birthtime,
				bytes: metadatos.size
			}

			if (incluirRutaCompleta) {
				respuesta.ruta = ruta;
			}

			if (incluirContenido) {
				let contenido = await fs.readFile(ruta);
				respuesta.contenido = contenido.toString();
			}

			return respuesta;
		} catch (errorFs) {
			this.log.info(`Ocurrió un error al obtener datos del fichero '${ruta}' [incluirContenido=${incluirContenido}]:`, errorFs);
			return null;
		}
	}

	async #generarArbolDeDumps(incluirRutaCompleta) {

		let directorioBaseDumps = C.log.getDirectorioDump();

		this.log.trace(`Generando listado de Dumps en el directorio base '${directorioBaseDumps}'`);

		// Abrimos el directorio base de dumps
		let directoriosDeFechas = await this.#leeContenidoDirectorio(directorioBaseDumps);

		if (!directoriosDeFechas?.length) {
			this.log.debug('No se han encontrado subdirectorios en el directorio base.');
			return null;
		}

		this.log.debug('Se han encontrado los siguientes subdirectorios en el directorio base:', directoriosDeFechas);
		let arbolDeDumps;
		for (let i = 0; i < directoriosDeFechas.length; i++) {
			let nombreDirectorioFecha = directoriosDeFechas[i];

			let directorioFechaDumps = directorioBaseDumps + SEPARADOR_DIRECTORIOS + nombreDirectorioFecha;

			let ficherosDump = await this.#leeContenidoDirectorio(directorioFechaDumps);
			if (!ficherosDump?.length) {
				this.log.debug(`No se han encontrado dumps dentro del directorio '${nombreDirectorioFecha}'.`)
				continue;
			}

			this.log.debug(`Se han encontrado los siguientes dumps en '${nombreDirectorioFecha}':`, ficherosDump)


			for (let j = 0; j < ficherosDump.length; j++) {
				let ficheroDump = ficherosDump[j];

				let idDump = ficheroDump.substring(0, ficheroDump.length - 5);
				let rutaCompletaDump = directorioFechaDumps + SEPARADOR_DIRECTORIOS + ficheroDump;
				let datosDump = await this.#generaInformacionDump(idDump, rutaCompletaDump, { incluirRutaCompleta });

				if (datosDump) {
					if (!arbolDeDumps) arbolDeDumps = {};
					if (!arbolDeDumps[nombreDirectorioFecha]) arbolDeDumps[nombreDirectorioFecha] = [];
					arbolDeDumps[nombreDirectorioFecha].push(datosDump);
				}
			}

		}

		return arbolDeDumps;
	}

	#encontrarDumpEnArbol(arbolDeDumps, idDump) {
		if (!arbolDeDumps || !idDump) return null;

		let nodoDumpEncontrado = null;
		Object.values(arbolDeDumps).forEach(listaDumps => {
			let dump = listaDumps.find(infoDump => infoDump.id === idDump);
			if (dump) nodoDumpEncontrado = dump;
		});
		return nodoDumpEncontrado;

	}

}


TxMonConsultaDump.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonConsultaDump;