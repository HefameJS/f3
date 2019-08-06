'use strict';


const memCache = require('memory-cache');
const fedicomCredentialsCache = new memCache.Cache();
fedicomCredentialsCache.countStats(true);


const checkUser = function( authReq ) {
	var cachedPassword = fedicomCredentialsCache.get( authReq.username );
	return  (cachedPassword && cachedPassword === authReq.password )
}

const addUser = function( authReq ) {
	fedicomCredentialsCache.put(authReq.username, authReq.password);
}

const stats = function () {
	var h = fedicomCredentialsCache.hits();
	var m = fedicomCredentialsCache.misses();
	var total = h + m;
	var ratio = total ? (h*100)/total : 0;

	return {
		hit: h,
		miss: m,
		entries: fedicomCredentialsCache.size(),
		hitRatio: ratio
	};
}

const clear = function () {
	fedicomCredentialsCache.clear();
}


module.exports = {
	check: checkUser,
	add: addUser,
	stats: stats
}
