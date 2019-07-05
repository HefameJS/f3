'use strict';

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
        this.itemList.push( { codigo: 'CORE-400', descripcion: 'No se entiende el cuerpo del mensaje' } );
      } else {
        console.error('ERROR EXPRESS NO CONTROLADO: ' + error.type);
        this.itemList.push( { codigo: 'CORE-001', descripcion: 'Error desconocido [' + error.type + ']' } );
      }
      return this;
    }

    // Si los parámetros de la llamada no son válidos
    this.itemList.push( { codigo: 'CORE-000', descripcion: 'Error desconocido' } );
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

}

module.exports = FedicomError;
