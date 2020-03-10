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
MONPID=$PIDDIR/f3-monitor.pid
WORKERNAME=f3-core-worker

mkdir -p $PIDDIR 2>/dev/null

UPDATE_GIT=no
MOSTRAR_AYUDA=no


while getopts "hu" OPT "${@:2}"
do
    case $OPT in
        h ) 
            MOSTRAR_AYUDA=yes
            ;;
        u ) echo "Se actualizan librerias NPM y codigo desde GIT"
            UPDATE_GIT=yes
            ;;
        \? ) echo "[WRN] Se ignoda la opcion invalida -$OPTARG";;
        : )  echo "[ERR] La opcion -$OPTARG requiere un argumento"
          exit 1 ;;
    esac
done



if [ $MOSTRAR_AYUDA == "yes"]
then
    echo "Uso: $0 (<accion> [<opciones>]) | -h"
    echo ""
    echo "    -h  Muestra esta ayuda"
    echo ""
    echo "<accion>:"
    echo "    start"
    echo "        Arranca los procesos de la aplicación Fedicom 3."
    echo ""
    echo "        <opciones>:"
    echo "            -u  Actualiza la aplicación desde el repositorio GIT."
    echo ""
    echo "    stop"
    echo "        Detiene los procesos de la aplicación Fedicom 3."
    echo ""
    echo "    restart"
    echo "        Reinicia los procesos de la aplicación Fedicom 3."
    echo "        Equivale a ejecutar 'f3 stop' y 'f3 start' en ese orden."
    echo ""
    echo "        <opciones>:"
    echo "            -u  Actualiza la aplicación desde el repositorio GIT."
    echo ""
    echo "    status"
    echo "        Muestra el estado de los procesos Fedicom 3 ejecuntandose en el servidor."
    exit 0
fi




update() {
    if [ $UPDATE_GIT == 'yes' ]
    then
        cd $SRCDIR
        git config --global credential.helper cache
        git pull
    fi

    cd $SRCDIR
    npm ci
}

start() {
    stop
    update
    cd $SRCDIR
    npm run core >/dev/null 2>/dev/null
    npm run monitor >/dev/null 2>/dev/null
    npm run watchdog >/dev/null 2>/dev/null
}

stop() {
    kill $(cat $COREPID 2>/dev/null) 2>/dev/null
    kill $(cat $WDPID 2>/dev/null) 2>/dev/null
    kill $(cat $MONPID 2>/dev/null) 2>/dev/null
}

status() {
    ps lf | grep f3 | grep -v grep | grep -v 'f3 status'
}






case $1 in
    'start')
        start 
    ;;
    'restart')    
        start 
    ;;
    'stop')
        stop 
    ;;
    'status')
        status
    ;;
esac


cd $ORIGINAL_PWD