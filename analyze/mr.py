# Multiple Regression.

from sklearn import linear_model
from decimal import Decimal
import json


data = json.loads(open('data1.json', 'r').read())['data']

X = []
Y = []

for obj in data:
    arr = obj['metadata'][:3]
    arr.append(obj['metadata'][-1])
    X.append(arr)
    layout = []
    for arr in obj['duration']:
        layout.append(arr[4] + arr[5])
    layout.sort(reverse=True)
    Y.append(sum(layout[:5]))

lr = linear_model.LinearRegression()
lr.fit(X, Y)

output = open('coef.txt', 'w')
for v in lr.coef_:
    v_ = Decimal(v).quantize(Decimal('1.00'))
    output.write(str(v_))
    output.write('\n')
output.close()
