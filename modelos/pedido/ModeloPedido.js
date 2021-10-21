'use strict';
const ModeloNodoPedido = require('modelos/pedido/ModeloNodoPedido');

class ModeloPedido {

	#nodos = [];
	#nodoVigente;
	#nodoInformado;

	constructor(nodos) {
		this.#nodos = nodos.map(nodo => new ModeloNodoPedido(nodo))
		this.#nodos.forEach(nodo => {
			if (nodo.es.relevante || !this.#nodoVigente) {
				this.#nodoVigente = nodo;
			}
			if (nodo.es.externa) {
				if (!this.#nodoInformado || nodo.es.relevante || this.#nodoVigente) {
					this.#nodoInformado = nodo;
				}
				if (!nodo.es.relevante && this.#nodoVigente !== nodo) {
					this.#nodoInformado = this.#nodoVigente;
				}
			}
		})

		if (this.#nodoVigente) this.#nodoVigente.es.vigente = true;
		if (this.#nodoInformado) this.#nodoInformado.es.informado = true;
	}

	getDatos() {
		return this.#nodos.map(nodo => nodo.getDatos())
	}

	get nodoVigente() {
		return this.#nodoVigente;
	}


}

module.exports = ModeloPedido;