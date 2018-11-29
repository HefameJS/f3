
var log4js = require('log4js'),
mongoAppender = require('log4js-node-mongodb');

var conf = global.config;
var logConf = conf.logger;

log4js.addAppender(
	mongoAppender.appender({
		 connectionString: conf.getMongoUrl(null, logConf.username, logConf.pwd, logConf.database, null),
		 collectionName: logConf.serverCollection
	}),
	'server'
);

log4js.addAppender(
	mongoAppender.appender({
		 connectionString: conf.getMongoUrl(null, logConf.username, logConf.pwd, logConf.database, null),
		 collectionName: logConf.txCollection
	}),
	'tx'
);

const loggers = {
	server: log4js.getLogger('server'),
	tx: log4js.getLogger('tx')
}

module.exports = loggers;
