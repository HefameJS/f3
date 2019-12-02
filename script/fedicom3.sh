#!/bin/bash

ORIGINAL_PWD=$(pwd)


# Garantizamos que el usuarios es fedicom3
if [ "$LOGNAME" != "fedicom3" ]
then
    # Si el usuario es root, relanzamos el script como usuario fedicom3
    if [ $(id -u) -eq 0 ]
    then    
        echo "Cambiando a usuario fedicom3 ..."
        su - fedicom3 -c "$0 $@"
    else
        echo "Debe ejecutarse como usuario fedicom3 o root"
        # exit 1
    fi
fi

SRCDIR=$HOME/fedicom3-core
DBDIR=$HOME/db
PIDDIR=$HOME/pid
COREPID=$PIDDIR/f3-core-master.pid
WDPID=$PIDDIR/f3-watchdog.pid
WORKERNAME=f3-core-worker

mkdir -p $PIDDIR 2>/dev/null

UPDATE_GIT=no
UPDATE_NPM=no
START_WATCHDOG=no


while getopts "hgnuw" OPT "${@:2}"
do
    case $OPT in
        h ) echo "Mostrar ayuda" ;;
        g ) echo "Se actualiza el código desde el repositorio GIT"
            UPDATE_GIT=yes
            ;;
        n ) echo "Se actualizan librerias NPM"
            UPDATE_NPM=yes
            ;;
        u ) echo "Se actualizan librerias NPM y codigo desde GIT"
            UPDATE_GIT=yes
            UPDATE_NPM=yes
            ;;
        w ) echo "Re inicia el servicio WatchDog"
            START_WATCHDOG=yes
            ;;
        \? ) echo "[WRN] Se ignoda la opcion invalida -$OPTARG";;
        : )  echo "[ERR] La opcion -$OPTARG requiere un argumento"
          exit 1 ;;
    esac
done






update() {
    if [ $UPDATE_GIT == 'yes' ]
    then
        cd $SRCDIR
        git config --global credential.helper cache
        git pull
    fi

    if [ $UPDATE_NPM == 'yes' ]
    then
        cd $SRCDIR
        npm update
    fi
}

start() {
    stop
    update
    cd $SRCDIR
    npm run core >/dev/null 2>/dev/null
    if [ "$START_WATCHDOG" == "yes" ]
    then
        npm run watchdog >/dev/null 2>/dev/null
    fi
}

stop() {
    kill $(cat $COREPID) >/dev/null 2>/dev/null
    kill $(cat $WDPID) >/dev/null 2>/dev/null
}

status() {
    ps -ef | grep f3 | grep -v grep
}



case $1 in
    'start')
        start 
    ;;
    'stop')
        stop 
    ;;
    'restart')
        stop
        start
    ;;
    'status')
        status
    ;;
esac


cd $ORIGINAL_PWD