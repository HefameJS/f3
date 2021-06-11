'use strict';
//const C = global.config;
//const K = global.constants;
//const M = global.mongodb;


/**
 * Clase que representa las condiciones que una transmisión debe cumplir para ser autorizada su ejecución.
 *
 * Opciones del constructor:
 *  - admitirSinTokenVerificado: Indica si se permite que la petición se ejecute sin necesidad de especificar un token válido.
 *    Por defecto es false. En caso de que este valor se establezca a true, el resto de condiciones se ignoran.
 *  - grupoRequerido: Indica el nombre del grupo que es obligatorio que el token lleve incluido para que se autorize la transmisión.
 * 	- simulaciones: Indica si se admiten transmisiones simuladas. 
 * 		- Esto indica que el token debe ser del dominio HEFAME y tener el permiso 'FED3_SIMULADOR'.
 * 		- Si se indica la opción 'grupo', el token deberá cumplir TAMBIEN con la condición del grupo.
 *  - simulacionesEnProduccion: Por defecto, las simulaciones en sistemas productivos son rechazadas. Activar esta opción para permitirlas igualmente. 
 * 	  Generalmente se usa para servicios de consulta donde no hay peligro en lanzarlos contra producción.
 * 	  Solo aplica si 'simulaciones' es true.
 */
class CondicionesAutorizacion {

	admitirSinTokenVerificado = false;
	grupoRequerido = null;
	simulaciones = false;
	simulacionesEnProduccion = false;

	constructor( condiciones ) {
		if (!condiciones) condiciones = {};

		this.admitirSinTokenVerificado = Boolean(condiciones.admitirSinTokenVerificado);
		if (condiciones.grupoRequerido) this.grupoRequerido = condiciones.grupoRequerido;
		this.simulaciones = Boolean(condiciones.simulaciones);
		this.simulacionesEnProduccion = Boolean(condiciones.simulacionesEnProduccion);
	}


}

module.exports = CondicionesAutorizacion;