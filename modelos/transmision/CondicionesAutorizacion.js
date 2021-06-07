'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
//const M = global.mongodb;


/**
 * Clase que representa las condiciones que una transmisión debe cumplir para ser autorizada su ejecución.
 *
 * Opciones del constructor:
 *  - tokenVerificado: Indica si se requiere que el token exista y esté verificado. Por defecto es true. En caso de que este valor se establezca a false,
 * 	  el resto de condiciones se ignoran.
 *  - grupo: Indica el nombre del grupo que es obligatorio que el token lleve incluido para que se autorize la transmisión.
 * 	- simulaciones: Indica si se admiten transmisiones simuladas. 
 * 		- Esto indica que el token debe ser del dominio HEFAME y tener el permiso 'FED3_SIMULADOR'.
 * 		- Si se indica la opción 'grupo', el token deberá cumplir TAMBIEN con la condición del grupo.
 *  - simulacionesEnProduccion: Por defecto, las simulaciones en sistemas productivos son rechazadas. Activar esta opción para permitirlas igualmente. 
 * 	  Generalmente se usa para servicios de consulta donde no hay peligro en lanzarlos contra producción.
 * 	  Solo aplica si 'simulaciones' es true.
 *  - simulacionRequiereCambioToken: Indica si la simulación debe indicar los datos de otro cliente (que será "suplantado"). 
 * 	  Esto hará que se busquen las cabeceras 'x-simulacion-usuario' y 'x-simulacion-dominio' y se genere un token simulando 
 *    como si la transmisión viniera con estas credenciales. Si no existieran estas cabeceras, no se autoriza.
 */
class CondicionesAutorizacion {

	#tokenVerificado = true;
	#grupo = null;
	#simulaciones = false;
	#simulacionesEnProduccion = false;
	#simulacionRequiereCambioToken = false;

	constructor( condiciones ) {

		if (!condiciones) condiciones = {};

		if (condiciones.tokenVerificado !== undefined) this.#tokenVerificado = Boolean(condiciones.tokenVerificado);
		if (condiciones.grupo) this.#grupo = condiciones.grupo;
		if (condiciones.simulaciones !== undefined) this.#simulaciones = Boolean(condiciones.simulaciones);
		if (condiciones.simulacionesEnProduccion !== undefined) this.#simulacionesEnProduccion = Boolean(condiciones.simulacionesEnProduccion);
		if (condiciones.simulacionRequiereCambioToken !== undefined) this.#simulacionRequiereCambioToken = Boolean(condiciones.simulacionRequiereCambioToken);

	}

}

module.exports = CondicionesAutorizacion;