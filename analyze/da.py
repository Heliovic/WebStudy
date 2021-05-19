# Dominance Analysis.

import copy
import json
import math
import itertools
from sklearn import linear_model


# Format: X = []
def sum_of_squares(X):
    l = len(X)
    mx = sum(X) / l
    dx = [v-mx for v in X]
    return sum([v**2 for v in dx])


# Format: X = [[]], Y = []
def explainable_variance(X, Y):
    SSY = sum_of_squares(Y)

    lr = linear_model.LinearRegression()
    lr.fit(X, Y)
    Y_ = [lr.predict([v])[0] for v in X]
    SSY_ = sum_of_squares(Y_)

    return SSY_ / SSY


tag = ['node', 'image', 'text', 'rule']
raw_data = json.loads(open('data1.json', 'r').read())['data']

predictor = []
criterion = []

for obj in raw_data:
    arr = obj['metadata'][:3]
    arr.append(obj['metadata'][-1])
    predictor.append(arr)
    
    layout = []
    for arr in obj['duration']:
        layout.append(arr[4] + arr[5])
    criterion.append(sum(layout))

# Generate all subsets of predictors.
complete_set = set(range(len(tag)))
all_subsets = []

for i in range(len(tag)-1):
    fix_sized_subsets = itertools.combinations(complete_set, i+1)
    for subset in fix_sized_subsets:
        all_subsets.append(list(subset))


def get_partial_predictors(indexes):
    pps = []
    for arr in predictor:
        entry = []
        for idx in indexes:
            entry.append(arr[idx])
        pps.append(entry)
    return pps


# Compare Additional contribution (AC) between 2 predictors.
dominance = [[0 for i in range(len(tag))] for j in range(len(tag))]

for i in range(len(tag)-1):
    for j in range(i+1, len(tag)):
        # Applicable subsets: 2^6 - 2^5 - 2^5 + 2^4 = 16.
        # 1. AC on empty set.
        aci = explainable_variance(get_partial_predictors([i]), criterion)
        acj = explainable_variance(get_partial_predictors([j]), criterion)
        if aci > acj:
            dominance[i][j] += 1
        elif acj > aci:
            dominance[j][i] += 1

        # 2. AC on all non-empty sets.
        for subset in all_subsets:
            if (not i in subset) and (not j in subset):
                ss = copy.deepcopy(subset)
                ss.append(i)
                aci = explainable_variance(
                    get_partial_predictors(ss), criterion)

                ss = copy.deepcopy(subset)
                ss.append(j)
                acj = explainable_variance(
                    get_partial_predictors(ss), criterion)

                if aci > acj:
                    dominance[i][j] += 1
                elif acj > aci:
                    dominance[j][i] += 1

overall_ev = explainable_variance(predictor, criterion)
print('Overall explainable variance:', overall_ev)

for i in range(len(tag)-1):
    for j in range(i+1, len(tag)):
        if dominance[i][j] > dominance[j][i]:
            print(tag[i], tag[j], dominance[i][j], dominance[j][i])
        else:
            print(tag[j], tag[i], dominance[j][i], dominance[i][j])
