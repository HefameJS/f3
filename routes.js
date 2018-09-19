
'use strict';

module.exports = function(app) {
  var authenticate = require('./controllers/authenticate');

  app.route('/authenticate')
	.get(authenticate.test);

};
