import requests
import os
import re

f = open('list.html', 'r', encoding='utf-8')
line = f.readline()

pattern = re.compile(r'<td><a href="(.*?)">')
result = pattern.findall(line)
print(result)
print(len(result))

for url in result:
    req = requests.get(url + '&amp;dl=1')
    with open(url[url.find('%2F') + 3:], "wb") as fp:
        fp.write(req.content)
