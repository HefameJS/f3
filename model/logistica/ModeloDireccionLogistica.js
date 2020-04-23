'use strict';
////const C = global.config;
const L = global.logger;
//const K = global.constants;


class DireccionLogistica {
	constructor(txId, json) {

		Object.assign(this, json);

		if (!this.codigo) {
			L.xe(txId, ['No se ha indicado el campo código en la dirección logística', this]);
			this.erronea = true;
		}

	}

	esErronea() {
		return this.erronea || false;
	}

}

module.exports = DireccionLogistica;

