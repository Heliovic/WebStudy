import os
import re

f = open('IPv6 Status of Alexa 500 Websites.html', 'r', encoding='utf-8')
lines = f.readlines()

pattern = re.compile(r'<th>(.*?)</th>')
result = []

for line in lines:
    if '.' not in line:
        continue
    result.extend(pattern.findall(line))

result = result[2:]

print(result)
print(len(result))

f = open('alexa500.txt', 'w', encoding='utf-8')

for line in result:
    f.write(line + '\n')

f.close()
