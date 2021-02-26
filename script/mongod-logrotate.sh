#!/bin/sh

PIDFILE=/var/run/mongodb/mongod.pid
LOGDIR=/var/log/mongodb

# Indicamos al proceso de mongod que realize la rotacion del log
kill -10 $(cat $PIDFILE) 2>/dev/null

# Comprimimos todos los ficheros de log no comprimidos, excluyendo el actual "mongod.log"
find $LOGDIR -name "mongod.log.*" -and ! -name "*.gz" -exec gzip {} \;

# Eliminamos los anteriores a 7s dias
find $LOGDIR -name "mongod.log.*.gz" -mtime +7 -exec rm -f {} \;
