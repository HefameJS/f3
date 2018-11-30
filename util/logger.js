
var log4js = require('log4js'),
mongoAppender = require('log4js-node-mongodb');

var conf = global.config;
var logConf = conf.logger;



log4js.configure({
    appenders: [
      { type: 'console' },
      {
			category: 'server',
			type: 'log4js-node-mongodb',
			connectionString: conf.getMongoUrl(null, logConf.username, logConf.pwd, logConf.database, null),
			collectionName: logConf.serverCollection
		},
		{
			category: 'tx',
			type: 'log4js-node-mongodb',
			connectionString: conf.getMongoUrl(null, logConf.username, logConf.pwd, logConf.database, null),
			collectionName: logConf.txCollection
		}
	]
});


var serverLog = log4js.getLogger('server');

serverLog.f = function(msg) {	serverLog.fatal( msg.length == 1 ? msg[0] : msg ); }
serverLog.e = function(msg) {	serverLog.error( msg.length == 1 ? msg[0] : msg ); }
serverLog.w = function(msg) {	serverLog.warn( msg.length == 1 ? msg[0] : msg ); }
serverLog.i = function(msg) {	serverLog.info( msg.length == 1 ? msg[0] : msg ); }
serverLog.d = function(msg) {	serverLog.debug( msg.length == 1 ? msg[0] : msg ); }
serverLog.t = function(msg) {	serverLog.trace( msg.length == 1 ? msg[0] : msg ); }


var txLog = log4js.getLogger('tx');

var convertOID = function(oid) {
	return oid.toString();
}

txLog.f = function(txId, msg) {
	txLog.fatal( {
		tx: convertOID(txId),
		msg: msg.length == 1 ? msg[0] : msg
	} );
}

txLog.e = function(txId, msg) {
	txLog.error( {
		tx: convertOID(txId),
		msg: msg.length == 1 ? msg[0] : msg
	} );
}

txLog.w = function(txId, msg) {
	txLog.warn( {
		tx: convertOID(txId),
		msg: msg.length == 1 ? msg[0] : msg
	} );
}

txLog.i = function(txId, msg) {
	txLog.info( {
		tx: convertOID(txId),
		msg: msg.length == 1 ? msg[0] : msg
	} );
}

txLog.d = function(txId, msg) {
	txLog.debug( {
		tx: convertOID(txId),
		msg: msg.length == 1 ? msg[0] : msg
	} );
}

txLog.t = function(txId, msg) {
	txLog.trace( {
		tx: convertOID(txId),
		msg: msg.length == 1 ? msg[0] : msg
	} );
}


const loggers = {
	server: serverLog,
	tx: txLog
}

module.exports = loggers;
