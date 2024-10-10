import os
import csv
import time
import sys

if len(sys.argv) <= 1:
    print('The sys.argv[1] is none!')
    exit() 
index = sys.argv[1]
if index is None:
    print('The index is none!')
    exit()

str_ = os.popen('tc qdisc show | grep "veth"').read().split('\n')
veth = []
for i in range(0, len(str_) - 1):
    veth.append(str_[i][str_[i].find("veth") : str_[i].find("veth") + 11])

if os.path.exists('tcdata_' + index + '.csv'):
    with open('tcdata_' + index + '.csv', 'r') as file:
        csv_reader = csv.reader(file)
        for row in csv_reader:
            # print(row)
            for i in range(0, len(veth)):
                os.system("tc qdisc change dev " + veth[i] + " root netem delay " + row[i] + "ms")
            time.sleep(0.1)
else:
    print('No file!')
    exit()