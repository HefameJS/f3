'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;


const ESTADOS_DE_NODO = {
    0: {code: 0, name: 'INICIANDO', desc: 'La instancia está iniciandose'},
    1: { code: 1, name: 'PRIMARIO', desc: 'Esta instancia contiene la copia primaria de la base de datos' },
    2: { code: 2, name: 'SECUNDARIO', desc: 'Instancia replicando datos' },

    4: { code: 4, name: 'SINCRONIZANDO', desc: 'La instancia se está sincronizando' },
    5: { code: 5, name: 'UNIENDOSE', desc: 'La instancia se está uniendo al clúster' },
    6: { code: 6, name: 'DESCONOCIDO', desc: 'No se conoce el estado' },
    7: { code: 7, name: 'ARBITRO', desc: 'Instancia sin datos para tiebreak' },
    8: { code: 8, name: 'DOWN', desc: 'La instancia no es accesible' },
    9: { code: 9,  name: 'ROLLBACK', desc: 'La instancia se está sincronizando tras un failover' },
    10: { code: 10, name: 'ELIMINADO', desc: 'La instancia ya no forma parde del clúster' }
}


class EstadoReplicaSet {
    constructor(data) {
        if (!data)
            throw {ok: false, msg: 'No hay datos del ReplicaSet'};

        this.name = data.set;
        this.time = data.date.getTime()
        this.heartbeatInterval = data.heartbeatIntervalMillis;

        this.members = [];
        data.members.forEach( (miembro) => {
            this.members.push(new MiembroReplicaSet(miembro));
        })

    }
}


class MiembroReplicaSet {
    constructor(data) {
        this.id = data.id;
        this.health = data.health;
        this.state = ESTADOS_DE_NODO[data.state];
        this.host = data.name;
        this.uptime = data.uptime;
        this.version = data.configVersion;

        if (data.state === 1) {
            this.electionDate = data.electionDate;
        } else {
            this.masterInstance = data.syncSourceHost;
            this.ping = data.pingMs; 
            this.delay = (new Date()).getTime() - data.lastHeartbeat;
            
        }

    }
}

module.exports = EstadoReplicaSet;