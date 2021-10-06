'use strict';
const K = global.K;
const M = global.M;

const ErrorFedicom = require("modelos/ErrorFedicom");
const Modelo = require("modelos/transmision/Modelo");



/**
 * offset: <number> * Por defecto: 0. 
 * limit: <number> * Por defecto: 50. Maximo: 50. 
 * numeroAlbaran: <string> 
 * fechaAlbaran: <string> 
 * numeroPedido: <string> 
 * numeroPedidoOrigen: <string> 
 * fechaDesde: <date> * Por defecto: 1 año atrás desde hoy 
 * fechaHasta: <date> * Por defecto: hoy
 * codigoCliente: <string> (obligatorio)
 * Nota: El intervalo de fechas entre fechaDesde y fechaHasta no puede ser superior a 1 año.
 */
class ConsultaAlbaran extends Modelo {

	metadatos = {
		errores: new ErrorFedicom(),
		errorProtocolo: false			// Indica si la petición cumple o no con el protocolo
	}

	offset;
	limit;
	codigoCliente;
	numeroAlbaran;
	numeroPedido;
	numeroPedidoOrigen;
	fechaDesde;
	fechaHasta;



	constructor(transmision) {
		super(transmision);

		let query = this.transmision.req.query;

		this.#procesarOffset(query.offset);
		this.#procesarLimit(query.limit);
		this.#procesarCodigoCliente(query.codigoCliente);
		this.#procesarFechas(query.fechaAlbaran, query.fechaDesde, query.fechaHasta);
		this.#procesarNumeroPedido(query.numeroPedido);
		this.#procesarNumeroPedidoOrigen(query.numeroPedidoOrigen);

	}

	tieneErrores() {
		return this.metadatos.errorProtocolo;
	}

	getErrores() {
		return this.metadatos.errores.getErrores();
	}

	#procesarCodigoCliente(codigoCliente) {

		if (!codigoCliente) {
			this.metadatos.errores.insertar('ALB-ERR-002', 'El "codigoCliente" es inválido.');
			this.metadatos.errorProtocolo = true;
			return;
		}

		// Si el código de cliente está en formato corto, vamos a utilizar el código de login
		// aprovechando que la búsqueda se realiza entre todos los códigos del mismo cliente.


		if (codigoCliente.length < 8) {
			let usuarioToken = this.transmision.token.getDatos().usuario;

			let codigoClienteLargo = codigoCliente;
			// Casos en donde el usuario es de la forma xxxxxxxx@hefame
			if (usuarioToken.includes('@')) {
				// Nos quedamos con la parte que va delante de la arroba.
				codigoClienteLargo = usuarioToken.split('@')[0];
			}
			// Casos de usuarios Borgino que son de la forma BF02901xxxxx
			else if (usuarioToken.startsWith('BF')) {
				// Eliminamos el BF y nos quedamos con el resto
				codigoClienteLargo = usuarioToken.slice(2);
			}

			this.log.info(`Se cambia el código de cliente corto por el del token. "${codigoCliente}" -> "${codigoClienteLargo}"`)
			codigoCliente = codigoClienteLargo;

		}

		this.codigoCliente = codigoCliente.padStart(10, '0');

	}

	#procesarOffset(offset) {
		this.offset = parseInt(offset) || 0;
		if (this.offset < 0) {
			this.metadatos.errores.insertar('ALB-ERR-007', 'El campo "offset" es inválido');
			this.metadatos.errorProtocolo = true;
		}
	}

	#procesarLimit(limit) {
		this.limit = parseInt(limit) || 50;
		if (this.limit > 50 || this.limit <= 0) {
			this.metadatos.errores.insertar('ALB-ERR-008', 'El campo "limit" es inválido');
			this.metadatos.errorProtocolo = true;
		}
	}

	#procesarFechas(fechaAlbaran, fechaDesde, fechaHasta) {

		// Si viene fechaAlbaran, esta manda sobre el resto.
		// De lo contrario, se usa fechaDesde/fechaHasta. Si alguno no aparece, se establece a la fecha actual.
		fechaAlbaran = Date.fromFedicomDate(fechaAlbaran);

		if (fechaAlbaran) {
			this.fechaDesde = this.fechaHasta = fechaAlbaran;
		} else {
			// Si no se especifica la fechaHasta, se establece a hoy.
			this.fechaHasta = Date.fromFedicomDate(fechaHasta) || new Date();

			// Si no se especifica la fechaDesde, se establece a un año atrás, desde la fechaHasta.
			// TODO: Este campo debería cambiarse para buscar desde el inicio del día
			this.fechaDesde = Date.fromFedicomDate(fechaDesde) || new Date(new Date(this.fechaHasta).setFullYear(this.fechaHasta.getFullYear() - 1));

			// Si hay que invertir las fechas...
			if (this.fechaDesde.getTime() > this.fechaHasta.getTime()) {
				let tmp = this.fechaDesde;
				this.fechaDesde = this.fechaHasta;
				this.fechaHasta = tmp;
			}

			// Comprobación de rango inferior a 1 año
			// TODO: Hacer configurable
			let diff = (this.fechaHasta.getTime() - this.fechaDesde.getTime()) / 1000;
			if (diff > 31622400) { // 366 dias * 24h * 60m * 60s
				this.metadatos.errores.insertar('ALB-ERR-009', 'El intervalo entre el parámetro "fechaDesde" y "fechaHasta" no puede ser superior a un año');
				this.metadatos.errorProtocolo = true;
			}
		}

	}

	#procesarNumeroPedido(numeroPedido) {
		if (numeroPedido) {
			this.numeroPedido = numeroPedido;
		}
	}

	#procesarNumeroPedidoOrigen(numeroPedidoOrigen) {
		if (numeroPedidoOrigen) {
			this.numeroPedidoOrigen = numeroPedidoOrigen;
		}
	}

	async generarConsultaSap() {
		let consultaSap = new ConsultaAlbaranSap(this.codigoCliente);
		consultaSap.setFechas(this.fechaDesde, this.fechaHasta);
		consultaSap.setOffset(this.offset);
		consultaSap.setLimit(this.limit);

		if (this.numeroAlbaran) {
			consultaSap.setNumeroAlbaran(this.numeroAlbaran);
		}

		if (this.numeroPedidoOrigen) {
			let numPedSap = await this.#buscaPorNumeroPedidoOrigen()
			consultaSap.setNumeroPedido(numPedSap);
		}

		if (this.numeroPedido) {
			let numPedSap = await this.#buscaPorCrc()
			consultaSap.setNumeroPedido(numPedSap);
		}

		return consultaSap;

	}

	async #buscaPorNumeroPedidoOrigen() {
		try {
			let consulta = {
				tipo: K.TIPOS.CREAR_PEDIDO,
				'pedido.codigoCliente': parseInt(this.codigoCliente.slice(-5)),
				'pedido.numeroPedidoOrigen': this.numeroPedidoOrigen
			}
			let opciones = {
				projection: {
					'pedido.pedidosAsociadosSap': 1
				}
			}

			let pedido = await M.col.transmisiones.findOne(consulta, opciones);


			if (pedido?.pedido?.pedidosAsociadosSap) {
				this.log.info('Obtenidos los siguientes números de pedido SAP para el numeroPedidoOrigen:', pedido.pedido.pedidosAsociadosSap);
				return pedido.pedido.pedidosAsociadosSap;
			} else {
				this.log.info(`No se ha encontrado la transmisión de pedido con numeroPedidoOrigen="${this.numeroPedidoOrigen}" para el cliente="${parseInt(this.codigoCliente.slice(-5))}"`);
			}
		} catch (mongoError) {
			this.log.err('Error al buscar la transmisión por numeroPedidoOrigen', mongoError);
		}
		return null;
	}

	async #buscaPorCrc() {

		if (!M.ObjectID.isValid(this.numeroPedido)) {
			this.log.info('El número de pedido no puede convertirse a ObjectID')
			return null;
		}

		try {
			let crc = new M.ObjectID(this.numeroPedido);
			let consulta = {
				type: K.TIPOS.CREAR_PEDIDO,
				'pedido.crc': crc
			}
			let opciones = {
				projection: {
					'pedido.pedidosAsociadosSap': 1
				}
			}

			let pedido = await M.col.transmisiones.findOne(consulta, opciones);
			this.log.info('Obtenido de MongoDB para el numeroPedido:', pedido);

			if (pedido?.pedido?.pedidosAsociadosSap) {
				this.log.info('Obtenidos los siguientes números de pedido SAP para el numeroPedido:', pedido.pedido.pedidosAsociadosSap);
				return pedido.pedido.pedidosAsociadosSap;
			} else {
				this.log.info(`No se ha encontrado la transmisión de pedido con numeroPedido="${this.numeroPedido}"`);
			}
		} catch (mongoError) {
			this.log.err('Error al buscar la transmisión por numeroPedido', mongoError);
		}
		return null;
	}

	generarJSON() {
		return {
			offset: this.offset,
			limit: this.limit,
			codigoCliente: this.codigoCliente,
			numeroAlbaran: this.numeroAlbaran,
			numeroPedido: this.numeroPedido,
			numeroPedidoOrigen: this.numeroPedidoOrigen,
			fechaDesde: this.fechaDesde,
			fechaHasta: this.fechaHasta

		}
	}
}



class FiltroCampoSap {

	sign;
	option;
	low = '';
	// high;

	constructor(sign, option, low, high) {
		this.sign = sign || 'I';
		this.option = option || 'EQ';
		if (low) this.low = low.toString();
		if (high) this.high = high.toString();
	}
}


class ConsultaAlbaranSap {

	#sinResultados = false;			// Indica que sabemos con antemano que la consulta NO dará resultados en SAP.
	#incluirPuntosEntrega = true;
	#soloConProforma = true;
	#offset = 0;
	#limit = 50;
	#campos = {};

	constructor(codigoCliente) {
		this.#campos['r_kunnr'] = [new FiltroCampoSap('I', 'EQ', codigoCliente)];
	}

	setSoloConProforma(flag) {
		this.#soloConProforma = Boolean(flag);
		return this;
	}

	setIncluirPuntoEntrega(flag) {
		this.#incluirPuntosEntrega = Boolean(flag)
		return this;
	}

	setOffset(offset) {
		this.#offset = offset;
		return this;
	}

	setLimit(limit) {
		this.#limit = limit;
		return this;
	}

	setFechas(inicio, fin) {

		if (!fin) {
			fin = new Date();
		}

		if (!inicio) {
			inicio = new Date(new Date(fin).setFullYear(fin.getFullYear() - 1))
		}
		inicio = Date.toSapDate(inicio);
		fin = Date.toSapDate(fin);

		if (inicio === fin) { // Si es el mismo día, esto es mas rápido
			this.#campos['r_erdat'] = [new FiltroCampoSap('I', 'EQ', inicio)];
		} else {
			this.#campos['r_erdat'] = [new FiltroCampoSap('I', 'BT', inicio, fin)];
		}

		
		return this;
	}

	setNumeroAlbaran(numeroAlbaran) {
		if (!numeroAlbaran) {
			return;
		}
		this.#campos['s_prof'] = [new FiltroCampoSap('I', 'EQ', numeroAlbaran)];
	}

	setNumeroPedido(numerosPedido) {

		if (!numerosPedido) {
			this.#sinResultados = true;
			return;
		}

		if (Array.isArray(numerosPedido)) {
			if (numerosPedido.length) {
				this.#campos['r_vbeln'] = numerosPedido.map(numeroPedido => new FiltroCampoSap('I', 'EQ', numeroPedido));
			}			else {
				this.#sinResultados = true;
			}
		} else {
			this.#campos['r_vbeln'] = [new FiltroCampoSap('I', 'EQ', numerosPedido)];
		}
	}

	generarJSON() {
		let root = {}
		root.no_all_pto = this.#incluirPuntosEntrega ? ' ' : 'X';
		root.only_yvcab = this.#soloConProforma ? 'X' : ' ';

		root.result_per_page = this.#limit;
		root.view_page = Math.floor(this.#offset / this.#limit) + 1;
		root.max_result = 0;

		for (let campo in this.#campos) {
			root[campo] = this.#campos[campo]
		}

		return root;
	}

	generarQueryString() {
		return JSON.stringify(this.generarJSON());
	}

	noVaADarResultados() {
		return this.#sinResultados;
	}


}




module.exports = ConsultaAlbaran;