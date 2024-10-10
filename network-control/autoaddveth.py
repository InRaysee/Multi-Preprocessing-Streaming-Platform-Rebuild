import os

str_ = os.popen('tc qdisc show | grep "veth"').read().split('\n')
veth = []
for i in range(0, len(str_) - 1):
    veth.append(str_[i][str_[i].find("veth") : str_[i].find("veth") + 11])
    if str_[i].find("netem") != -1:
        temp = os.system("tc qdisc del dev " + veth[i] + " root netem")
    temp = os.system("tc qdisc add dev " + veth[i] + " root netem")

file_data = ""
count = 0
with open("autotc.sh", "r", encoding="utf-8") as f:
    for line in f:
        if "veth" in line:
            line = line.replace(line[line.find("veth") : line.find("veth") + 11], veth[count])
            count += 1
        file_data += line
with open("autotc.sh", "w", encoding="utf-8") as f:
    f.write(file_data)

for i in range(1, 5):
    file_name = 'autotc_' + str(i) + '.sh'
    file_data = ""
    count = 0
    with open(file_name, "r", encoding="utf-8") as f:
        for line in f:
            if "veth" in line:
                line = line.replace(line[line.find("veth") : line.find("veth") + 11], veth[count])
                count += 1
            file_data += line
    with open(file_name, "w", encoding="utf-8") as f:
        f.write(file_data)
