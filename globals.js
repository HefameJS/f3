
require('util/nativeExtensions');

global.constants = require('model/K');
global.instanceID = require('os').hostname() + '-' + process.pid + '-' + global.constants.SERVER_VERSION;
global.config = require('config');
global.logger = require('util/logger');