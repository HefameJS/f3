'use strict';



class SensorPrtg {

	constructor() {
		this.prtg = {
			result: []
		};
	}

	ponerEnError(mensaje) {
		this.prtg.error = "1";
		this.prtg.text = mensaje;
	}

	/*
            {
                "LimitMaxWarning": "90",
                "Float": 1,
                "Channel": "Uso de memoria fisica",
                "Value": "95.0",
                "LimitMode": 1,
                "Unit": "Percent",
                "LimitMaxError": "95"
            },
	*/
	resultado(nombre, valor, unidad) {
		this.prtg.result.push({
			"Channel": nombre + '',
			"Value": valor + '',
			"Unit": unidad + ''
		});
	}

}

module.exports = SensorPrtg;