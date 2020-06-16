'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

class ErrorFedicom {

  constructor(codigoError, descripcion, codigoRespuestaHTTP) {
    this.listaErroresFedicom = [];
    this.codigoRespuestaHTTP = 500;

    if (codigoError) {
      this.add(codigoError, descripcion, codigoRespuestaHTTP);
    }
  }

  unir(otroError) {
    if (otroError && otroError.constructor.name === 'ErrorFedicom') {
      this.codigoRespuestaHTTP = otroError.codigoRespuestaHTTP;
      this.listaErroresFedicom = ErrorFedicom.unir(this, otroError).listaErroresFedicom;
    }

    return this;
  }

  static unir(a, b) {
    if (a && a.constructor.name === 'ErrorFedicom' && b && b.constructor.name === 'ErrorFedicom') {
      b.listaErroresFedicom.forEach((error) => { a.listaErroresFedicom.push(error); });
      return a;
    } else {
      if (a && a.constructor.name === 'ErrorFedicom') return a;
      if (b && b.constructor.name === 'ErrorFedicom') return b;
      return new ErrorFedicom();
    }
  }

  add(error, descripcion, httpCode) {

    // Se llama al constructor pasando strings para construir manualmente el objeto de error
    if (error && descripcion && typeof error === 'string' && typeof descripcion === 'string') {
      this.codigoRespuestaHTTP = (typeof httpCode === 'number') ? httpCode : this.codigoRespuestaHTTP ;
      this.listaErroresFedicom.push( { codigo: error, descripcion: descripcion } );
      return this;
    }

    // Se llama utilizando un error devuelto por Express.
    if (error && error.type && error.statusCode) {
      this.codigoRespuestaHTTP = (typeof statusCode === 'number') ?  error.statusCode : this.codigoRespuestaHTTP ;

      if (error.type === 'entity.parse.failed') {
        this.codigoRespuestaHTTP = 400;
        this.listaErroresFedicom.push( { codigo: 'HTTP-400', descripcion: 'No se entiende el cuerpo del mensaje' } );
      } else {
        console.error('ERROR EXPRESS NO CONTROLADO: ' + error.type);
        this.listaErroresFedicom.push( { codigo: 'HTTP-500', descripcion: 'Error desconocido [' + error.type + ']' } );
      }
      return this;
    }

    // Si los parámetros de la llamada no son válidos
    this.listaErroresFedicom.push( { codigo: 'HTTP-500', descripcion: 'Error desconocido' } );
    return this;
  }

  hasError() {
	  return (this.listaErroresFedicom.length > 0)
  }

  getErrors() {
	  return this.listaErroresFedicom;
  }

  enviarRespuestaDeError(expressRes) {
    expressRes.status(this.codigoRespuestaHTTP).json(this.listaErroresFedicom);
    return this.listaErroresFedicom;
  }

  /**
   * Crea un error fedicom a partir de un error o excepcion cualquiera.
   * - Si el objeto pasado es un error Fedicom, se devuelve tal cual.
   * - En cualquier otro caso, se genera un error 500 genérico con el ID de transmisión que lo generó.
   *    - Adicionalmente, en caso de pasarse una excepción, mandará la pila de ejecución impresa al log.
   * 
   * @param {*} txId El ID de la transmisión que genera el error.
   * @param {*} excepcion El objeto con la excepción / error a convertir a ErrorFedicom.
   * @param {*} codigoErrorFedicom El codigo de error Fedicom. Por defecto HTTP-ERR-500.
   */
  static desdeExcepcion(txId, excepcion, codigoErrorFedicom) {
    codigoErrorFedicom = codigoErrorFedicom ? codigoErrorFedicom : 'HTTP-ERR-500';

    if (excepcion.enviarRespuestaDeError) { // Es un ErrorFedicom, se devuelve tal cual
      return excepcion;
    } 

    // Si es una excepcion, agrega en un string las líneas de la pila de ejecución para debug
    let errorToLog = '';
    if (excepcion.stack && excepcion.stack.split) {
      errorToLog = excepcion.stack.split(/\r?\n/);
    }

    L.xt(txId, ['Se convirtió una excepción en un ErrorFedicom', errorToLog, excepcion]);
    return new ErrorFedicom(codigoErrorFedicom, 'Error interno del servidor - ' + txId, 500);
  }

  /**
   * Este método provee un atajo para enviar un único codigo de error Fedicom al cliente.
   * @param {*} expressRes El objeto de respuesta HTTP de express
   * @param {*} codigo El código del error Fedicom (i.e. AUTH-004, LIN-PED-ERR-001, etc...)
   * @param {*} descripcion El texto descriptivo del error
   * @param {*} codigoRespuestaHTTP El código de respuesta HTTP asociado al error
   */
  static generarYEnviarError(expressRes, codigo, descripcion, codigoRespuestaHTTP) {
    let errorFedicom = new ErrorFedicom(codigo, descripcion, codigoRespuestaHTTP);
    return errorFedicom.enviarRespuestaDeError(expressRes);
  }

  /**
   * Genera y envía un error fedicom para las respuestas erroneas que da el proceso monitor.
   * 
   * @param {*} expressRes 
   * @param {*} descripcion 
   * @param {*} codigoRespuestaHTTP 
   */
  static generarYEnviarErrorMonitor(expressRes, descripcion, codigoRespuestaHTTP) {
    return ErrorFedicom.generarYEnviarError(expressRes, 'MONITOR-ERR-999', descripcion, codigoRespuestaHTTP || 500);
  }
}

module.exports = ErrorFedicom;
