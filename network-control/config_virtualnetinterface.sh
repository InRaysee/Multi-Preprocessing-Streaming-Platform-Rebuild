#!/bin/bash
 
PASSWD="FileServer"
TAP_NETWORK="192.168.0.1"
VIR_DEV_NUM=1
DESC="Virtual net interface config"
 
do_start() {
  for ((i=100; i<100+VIR_DEV_NUM; i++))
  do
    echo ${PASSWD} | sudo -S ifconfig eno1:${i} 192.168.13.${i} up
    echo "eno1:${i} - 192.168.13.${i} up"
  done
}
 
do_stop() {
  for ((i=100; i<100+VIR_DEV_NUM; i++))
  do
    echo ${PASSWD} | sudo -S ifconfig eno1:${i} down
    echo "eno1:${i} - 192.168.13.${i} down"
  done
}

do_restart() {
  do_stop
  do_start
}

check_status() {
  for ((i=100; i<100+VIR_DEV_NUM; i++))
  do
    ifconfig eno1:${i}
  done
}
 
case $1 in 
  start)    do_start;;
  stop)     do_stop;;
  restart)  do_restart;;
  status)
            echo "Status of $DESC: "
            check_status
            exit "$?"
            ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1 
esac
