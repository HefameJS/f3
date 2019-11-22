'use strict';
//const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;

class FedicomError {

  constructor(error, descripcion, httpCode) {
    this.itemList = [];
    this.httpCode = 500;

    if (error) {
      this.add(error, descripcion, httpCode);
    }
  }

  merge(otherError) {
    if (otherError && otherError.constructor.name === 'FedicomError') {
      this.httpCode = otherError.httpCode;
      this.itemList = FedicomError.merge(this, otherError).itemList;
    }

    return this;
  }

  static merge(a, b) {
    if (a && a.constructor.name === 'FedicomError' && b && b.constructor.name === 'FedicomError') {
      b.itemList.forEach( (error) => { a.itemList.push(error); });
      return a;
    } else {
      if (a && a.constructor.name === 'FedicomError') return a;
      if (b && b.constructor.name === 'FedicomError') return b;
      return new FedicomError();
    }


  }

  add(error, descripcion, httpCode) {

    // Se llama al constructor pasando strings para construir manualmente el objeto de error
    if (error && descripcion && typeof error === 'string' && typeof descripcion === 'string') {
      this.httpCode = (typeof httpCode === 'number') ? httpCode : this.httpCode ;
      this.itemList.push( { codigo: error, descripcion: descripcion } );
      return this;
    }

    // Se llama utilizando un error devuelto por Express.
    if (error && error.type && error.statusCode) {
      this.httpCode = (typeof statusCode === 'number') ?  error.statusCode : this.httpCode ;

      if (error.type === 'entity.parse.failed') {
        this.httpCode = 400;
        this.itemList.push( { codigo: 'HTTP-400', descripcion: 'No se entiende el cuerpo del mensaje' } );
      } else {
        console.error('ERROR EXPRESS NO CONTROLADO: ' + error.type);
        this.itemList.push( { codigo: 'HTTP-500', descripcion: 'Error desconocido [' + error.type + ']' } );
      }
      return this;
    }

    // Si los parámetros de la llamada no son válidos
    this.itemList.push( { codigo: 'HTTP-500', descripcion: 'Error desconocido' } );
    return this;
  }

  hasError() {
	  return (this.itemList.length > 0)
  }

  getErrors() {
	  return this.itemList;
  }

  send(expressRes) {
    expressRes.status(this.httpCode).json(this.itemList);
    return this.itemList;
  }

  static fromException(txId, ex, errorCode) {
    errorCode = errorCode ? errorCode : 'HTTP-ERR-500';

    if (ex.send) { // Es un FedicomError, se devuelve tal cual
      return ex;
    } 
    var errorToLog = '';
    if (ex.stack && ex.stack.split) {
      errorToLog = ex.stack.split(/\r?\n/);
    }

    L.xe(txId, ['Se convirtió una excepción en un FedicomError', errorToLog, ex]);
    return new FedicomError('HTTP-500', 'Error interno del servidor - ' + txId, 500);
  }
}

module.exports = FedicomError;
