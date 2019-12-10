
global.BASE = __dirname + '/';
require(BASE + 'util/nativeExtensions');

global.constants = require(BASE + 'model/K');

global.instanceID = require('os').hostname() + '-' + process.pid + '-' + global.constants.SERVER_VERSION;
global.config = require(BASE + 'config');
global.logger = require(BASE + 'util/logger');