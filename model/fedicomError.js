

class FedicomError {

  constructor(error, descripcion, httpCode) {
    this.itemList = [];
    this.httpCode = 500;
    this.add(error, descripcion, httpCode);
  }

  add(error, descripcion, httpCode) {

    // Se llama al constructor pasando strings para construir manualmente el objeto de error
    if (error && descripcion && typeof error === 'string' && typeof descripcion === 'string') {
      this.httpCode = (typeof statusCode === 'number') ?  statusCode : this.httpCode ;
      this.itemList.push( { codigo: error, descripcion: descripcion } );
      return;
    }

    // Se llama utilizando un error devuelto por Express.
    if (error && error.type && error.statusCode) {
      this.httpCode = (typeof statusCode === 'number') ?  error.statusCode : this.httpCode ;

      if (error.type === 'entity.parse.failed') {
        this.itemList.push( { codigo: 'CORE-400', descripcion: 'No se entiende el cuerpo del mensaje' } );
      } else {
        console.error('ERROR EXPRESS NO CONTROLADO: ' + error.type);
        this.itemList.push( { codigo: 'CORE-001', descripcion: 'Error desconocido [' + error.type + ']' } );
      }
      return;
    }

    // Si los parámetros de la llamada no son válidos
    this.itemList.push( { codigo: 'CORE-000', descripcion: 'Error desconocido' } );

  }

  send(expressRes) {
    return expressRes.status(this.httpCode).json(this.itemList);
  }

}

module.exports = FedicomError;
