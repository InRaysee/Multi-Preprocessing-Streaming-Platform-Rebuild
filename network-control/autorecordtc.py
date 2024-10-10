import random
import csv
import sys

if len(sys.argv) <= 1:
    print('The sys.argv[1] is none!')
    exit() 
index = sys.argv[1]
if index is None:
    print('The index is none!')
    exit()

delay = [[]]
for i in range(0, 6):
    delay[0].append(int(index))

speed = [0, 0, 0, 0, 0, 0]

count = 1
total = 3000  # 5 mins with sleep 0.1

while count < total:
    temp = delay
    delay.append(delay[len(delay) - 1].copy())
    for i in range(0, len(delay[len(delay) - 1])):
        speed[i] = speed[i] + random.randint(-2, 2)
        if speed[i] < -10:
            speed[i] = -10
        elif speed[i] > 10:
            speed[i] = 10
        delay[len(delay) - 1][i] = delay[len(delay) - 1][i] + speed[i]
        if delay[len(delay) - 1][i] < 0:
            delay[len(delay) - 1][i] = 0
        elif delay[len(delay) - 1][i] > delay[0][0] * 2:
            delay[len(delay) - 1][i] = delay[0][0] * 2
    count = count + 1

with open('tcdata_' + index + '.csv', 'w', newline='') as file:
    csv_writer = csv.writer(file, delimiter=',')
    csv_writer.writerows(delay)
