'use strict';
// const BASE = global.BASE;
// const config = global.config;
// const L = global.logger;



module.exports = function(pedidosAsociados) {
    if (!pedidosAsociados) return undefined;
    if (!pedidosAsociados.forEach) return [pedidosAsociados];
    var result = [];
    pedidosAsociados.forEach((nPed) => {
        if (nPed) result.push(nPed);
    });
    if (result.length > 0) return result;
    return undefined;
}