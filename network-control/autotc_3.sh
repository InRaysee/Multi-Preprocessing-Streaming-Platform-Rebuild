#!/bin/bash

delay=(400 400 400 400 400 400)
speed=(0 0 0 0 0 0)

while :
do
    for i in {0..5};
    do
        speed[$i]=`expr ${speed[$i]} + $(($RANDOM%5-2))`
        if [ ${speed[$i]} -lt -10 ]; then
            speed[$i]=-10
        elif [ ${speed[$i]} -gt 10 ]; then
            speed[$i]=10
        fi
        delay[$i]=`expr ${delay[$i]} + ${speed[$i]}`
        if [ ${delay[$i]} -lt 0 ]; then
            delay[$i]=0
        elif [ ${delay[$i]} -gt 800 ]; then
            delay[$i]=800
        fi
    done
    tc qdisc change dev vethea95b7f root netem delay ${delay[0]}ms
    tc qdisc change dev veth39cf345 root netem delay ${delay[1]}ms
    tc qdisc change dev veth24e55ce root netem delay ${delay[2]}ms
    tc qdisc change dev vethba52c47 root netem delay ${delay[3]}ms
    tc qdisc change dev veth9f03e38 root netem delay ${delay[4]}ms
    tc qdisc change dev veth775f555 root netem delay ${delay[5]}ms
    echo "Speed: {${speed[*]}} ms"
    echo "Delay: {${delay[*]}} ms"
    echo ""
    sleep 0.1
done
echo "END"
