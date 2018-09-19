

class FedicomError {
  constructor(error, text, httpCode) {

    // Se llama al constructor pasando strings para construir manualmente el objeto de error
    if (error && text && typeof error === 'string' && typeof text === 'string') {
      return this.__setObjectData(error, text, httpCode);
    }

    // Se llama utilizando un error devuelto por Express.
    if (error && error.type && error.statusCode) {
      switch (error.type) {
        case 'entity.parse.failed' : return this.__setObjectData('CORE-400', 'No se entiende el cuerpo del mensaje', error.statusCode);
        default:
          console.log('ERROR EXPRESS NO CONTROLADO: ' + error.type);
          return this.__setObjectData('CORE-000', 'Error desconocido [' + error.type + ']', error.statusCode);
      }
    }

    // Si los parámetros de la llamada no son válidos
    return this.__setObjectData('CORE-001', 'Error desconocido.', 500);


  }

  __setObjectData(fedicomCode, text, statusCode) {
    this.fedicomCode = fedicomCode;
    this.text = text;
    this.statusCode = (typeof statusCode === 'number') ?  statusCode : 500 ;
  }



  toJson(asObject) {
    var error = {
      codigo: this.fedicomCode,
      descripcion: this.text
    }

    if (asObject) return error;
    else return [error];
  }

}

module.exports = FedicomError;
