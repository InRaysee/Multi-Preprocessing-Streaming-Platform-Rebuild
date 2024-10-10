#!/bin/bash

delay=(200 200 200 200 200 200)
rate=(10 10 10 10 10 10)

while :
do
    for i in {0..5};
    do
        delay[$i]=`expr ${delay[$i]} + $(($RANDOM%101-50))`
        rate[$i]=`expr ${rate[$i]} + $(($RANDOM%3-1))`
        if [ ${delay[$i]} -lt 0 ]; then
            delay[$i]=0
        elif [ ${delay[$i]} -gt 400 ]; then
            delay[$i]=400
        fi
        if [ ${rate[$i]} -lt 1 ]; then
            rate[$i]=1
        elif [ ${rate[$i]} -gt 20 ]; then
            rate[$i]=20
        fi
    done
    tc qdisc change dev vethea95b7f root netem delay ${delay[0]}ms rate ${rate[0]}Mbit
    tc qdisc change dev veth39cf345 root netem delay ${delay[1]}ms rate ${rate[1]}Mbit
    tc qdisc change dev veth24e55ce root netem delay ${delay[2]}ms rate ${rate[2]}Mbit
    tc qdisc change dev vethba52c47 root netem delay ${delay[3]}ms rate ${rate[3]}Mbit
    tc qdisc change dev veth9f03e38 root netem delay ${delay[4]}ms rate ${rate[4]}Mbit
    tc qdisc change dev veth775f555 root netem delay ${delay[5]}ms rate ${rate[5]}Mbit
    echo "Delay: {${delay[*]}} ms"
    echo "Rate: {${rate[*]}} Mbit"
    sleep 0.5
done
echo "END"
