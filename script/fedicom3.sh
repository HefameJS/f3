#!/bin/bash

CACHEDIR=/home/fedicom3/cache
SRCDIR=/home/fedicom3/f3

C_RED="\e[0;31m"
C_BLUE="\e[0;36m"
C_GREEN="\e[0;32m"
C_RESET="\e[0m"



mostrar_ayuda() {
  echo "Uso: $0 (<accion> [<opciones>]) | -h"
  echo ""
  echo "    -h  Muestra esta ayuda"
  echo ""
  echo "ACCIONES:"
  echo "    start"
  echo "        Arranca los procesos de la aplicación Fedicom 3."
  echo ""
  echo "    stop"
  echo "        Detiene los procesos de la aplicación Fedicom 3."
  echo ""
  echo "    restart"
  echo "        Reinicia los procesos de la aplicación Fedicom 3."
  echo "        Equivale a ejecutar 'f3 stop' y 'f3 start' en ese orden."
  echo ""
  echo "    status"
  echo "        Muestra el estado de los procesos Fedicom 3 ejecuntandose en el servidor."
  echo ""
  echo "OPCIONES:"
  echo "    --actualizar-git -u"
  echo "        Actualiza la aplicacion desde el repositorio GIT."
  echo ""
  echo "    --actualizar-npm -n"
  echo "        Realiza una instalación límpia de las dependencias NodeJS."
  echo ""
  echo "    --limpiar-log -l"
  echo "        Elimina los logs del directorio de logs. Esto NO elimina los ficheros de DUMP."
  echo ""
  echo "    --limpiar-sqlite -s"
  echo "        Purga la base de datos auxiliar SQLite."
  echo ""
}



if [ "$1" == "-h" ] || [ "$1" == "--help" ]
then
	 mostrar_ayuda
	exit 0
fi



ORIGINAL_PWD=$(pwd)



# Garantizamos que el usuarios es fedicom3
if [ "$LOGNAME" != "fedicom3" ]
then
	# Si el usuario es root, relanzamos el script como usuario fedicom3
	if [ $(id -u) -eq 0 ]
	then
		echo "Cambiando a usuario fedicom3 ..."
		su - fedicom3 -c "$0 $@"
		exit $?
	else
		echo "$C_RED Debe ejecutarse como usuario fedicom3 o root $C_RESET"
		exit 1
	fi
fi

# DEFINICION DE CONSTANTES Y CREACION DE DIRECTORIOS



# Recordamos la ACCION a realizar y transformamos las opciones largas en cortas

ACCION=$1

shift

for OPT in "$@"; do
	shift
	case "$OPT" in
		"--help")				set -- "$@" "-h" ;;
		"--limpiar-sqlite")		set -- "$@" "-s" ;;
		"--limpiar-log")		set -- "$@" "-l" ;;
		"--actualizar-git")		set -- "$@" "-u" ;;
		"--actualizar-npm")		set -- "$@" "-n" ;;
		*)						set -- "$@" "$OPT"
		esac
done


# Opciones por defecto
UPDATE_GIT=no
LIMPIAR_SQLITE=no
LIMPIAR_LOG=no
MOSTRAR_AYUDA=no
UPDATE_NPM=no

while getopts "hslun" OPT "$@"
do
	case "$OPT" in
		h ) 
			MOSTRAR_AYUDA=yes
			;;
		u ) 
			UPDATE_GIT=yes
			;;
		s ) 
			LIMPIAR_SQLITE=yes
			;;    
		l ) 
			LIMPIAR_LOG=yes
			;;
		n ) 
			UPDATE_NPM=yes
			;;
        
		\? ) echo "$C_RED[WRN] Se ignoda la opcion invalida -$OPTARG $C_RESET";;
		: )  echo "$C_RED[ERR] La opcion -$OPTARG requiere un argumento $C_RESET"
			exit 1 ;;
    esac
done


# DEFINICION DE FUNCIONES


limpiar_log() {
	if [ $LIMPIAR_LOG == 'yes' ]
	then
		LOGDIR="$CACHEDIR/logs"
		echo -e "\n$C_BLUE # LIMPIANDO LOGS ANTIGUOS DEL CONCENTRADOR (No se eliminaran los DUMPS) #$C_RESET\n"
		find $LOGDIR -name "*.log" -ls -exec rm -f {} \;
		echo -e "\n"
	fi
}

limpiar_sqlite() {
	if [ $LIMPIAR_SQLITE == 'yes' ]
	then
		DBDIR="$CACHEDIR/db"
		echo -e "\n$C_BLUE # PURGANDO BASE DE DATOS SQLITE #$C_RESET\n"
		mv $DBDIR/db.sqlite $DBDIR/db.sqlite.old
		echo "La base de datos antigua ha sido renombrada a $DBDIR/db.sqlite.old"
		echo -e "\n"
	fi
}

actualizar_git() {
	if [ $UPDATE_GIT == 'yes' ]
	then
		echo -e "\n$C_BLUE # ACTUALIZANDO CODIGO FUENTE DESDE EL REPOSITORIO GIT #$C_RESET\n"
		cd $SRCDIR
		echo -e "Rama actual: $(git rev-parse --abbrev-ref HEAD)"
		
		git config --global credential.helper cache >/dev/null 2>/dev/null
		git stash >/dev/null 2>/dev/null
		git stash clear >/dev/null 2>/dev/null
		git pull
		echo -e "\n"
	fi
}

actualizar_npm() {
	if [ $UPDATE_NPM == 'yes' ]
	then
		echo -e "\n$C_BLUE # REALIZANDO INSTALACION LIMPIA DE DEPENDENCIAS NODEJS #$C_RESET\n"
		cd $SRCDIR
		npm ci
		echo -e "\n"
	fi
}





start() {
	stop

	limpiar_log
	limpiar_sqlite
	actualizar_git
	actualizar_npm

	echo -e "\n$C_GREEN # ARRANCANDO PROCESOS DEL CONCENTRADOR FEDICOM 3 #$C_RESET\n"
	cd $SRCDIR
	npm run service >/dev/null 2>/dev/null

	sleep 1
	status
}

stop() {
	PIDFILE=$CACHEDIR/f3-master.pid	
	echo -e "\n$C_RED # DETENIENDO PROCESOS DEL CONCENTRADOR FEDICOM 3 #$C_RESET\n"
	echo -e "\t- Detendiendo proceso master con PID $(cat $PIDFILE 2>/dev/null) ..."
	kill $(cat $PIDFILE 2>/dev/null) 2>/dev/null
}

status() {
	ps lf | head -1 | cut -c 8-20,70-
	ps -e lf | grep f3 | grep -v grep | grep -v '/bin/bash' | grep -v 'f3 status' | cut -c 8-20,70-
	echo ""
}


# EJECUCION DE LAS ACCIONES PERTINENTES


if [ $MOSTRAR_AYUDA == 'yes' ]
then
	mostrar_ayuda
	exit 0
fi


case $ACCION in
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
	*)
		mostrar_ayuda
		exit 1
	;;

esac


cd $ORIGINAL_PWD
