import copy
import json
import math
import itertools
from matplotlib import pyplot
from sklearn import linear_model

import numpy
import pandas
import statsmodels.formula.api as formula


def mean(array):
    return sum(array) / len(array)


# This equals to the R-Squared value of a linear regression.
def explainable_variance(origin, prediction):
    m1 = mean(origin)
    m2 = mean(prediction)
    var1 = sum([(v-m1)**2 for v in origin])
    var2 = sum([(v-m2)**2 for v in prediction])
    return var2 / var1


# Predictor data form: [[list for variable X1], [list for variable X2], ...]
# Criterion data form: [y1, y2, ... , yn]
# A fitting equation is explainable, only when all the variables have (1) positive coefficients
# and (2) p-values that are smaller than 0.05; the significance of an equation is characterized by
# r-squared value (the greater the better) and condition number (the smaller the better).
def OLS(y, x1, x2, x3, x4, x5, x6):
    data_frame = pandas.DataFrame({'Y': y, 'X1': x1, 'X2': x2, 'X3': x3, 'X4': x4, 'X5': x5, 'X6': x6})
    # result = formula.ols(formula='Y ~ X1 + X2 + X6', data=data_frame).fit()
    # print(result.summary())
    # print(list(result.params))
    # print(result.summary().tables[0].as_csv())
    # print(result.summary().tables[1].as_csv())
    # print(result.summary().tables[2].as_csv())
    # https://www.statsmodels.org/devel/generated/statsmodels.regression.linear_model.RegressionResults.html
    # print(result.condition_number, result.rsquared, list(result.pvalues), list(result.tvalues))

    variables = ['X1', 'X2', 'X3', 'X4', 'X5', 'X6']
    combinations = []
    for i in range(len(variables)-1):
        subset = itertools.combinations(variables, i+1)
        for vs in subset:
            combinations.append(list(vs))

    overall_results = []
    for vc in combinations:
        rightside_formula = ''
        for i in range(len(vc)):
            if i > 0:
                rightside_formula = rightside_formula + ' + '
            rightside_formula = rightside_formula + vc[i]
        result = formula.ols(formula='Y ~ ' + rightside_formula, data=data_frame).fit()
        overall_results.append([vc, list(result.params), list(result.pvalues), result.rsquared, result.condition_number])
    
    def equation_filter(res):
        for i in range(1, len(res[1])):
            if res[1][i] < 0:
                return False
        for i in range(1, len(res[2])):
            if res[2][i] > 0.05:
                return False
        return True

    explainable_equations = list(filter(equation_filter, overall_results))
    explainable_equations.sort(key=lambda l: l[3], reverse=True)      # sort by r-squared value.

    # for ee in explainable_equations:
    #     print(ee)
    print(explainable_equations[0])


# Predictor data form: [[x11, x21, x31, ...], ... , [x1n, x2n, x3n, ...]]
# Criterion data form: [y1, y2, ... , yn]
def linear_regression_remove_10_percent_outliers(predictors, criterion):
    lr = linear_model.LinearRegression()
    lr.fit(predictors, criterion)
    output = lr.predict(predictors)

    residual = [(abs(criterion[i] - output[i]), i) for i in range(len(output))]
    residual.sort(key=lambda v: v[0])
    # remove 10% data points with highest residual
    residual = residual[:int(len(residual) * 0.9)]

    predictors_ = [predictors[v[1]] for v in residual]
    criterion_ = [criterion[v[1]] for v in residual]

    x1 = [v[0] for v in predictors_]
    x2 = [v[1] for v in predictors_]
    x3 = [v[2] for v in predictors_]
    x4 = [v[3] for v in predictors_]
    x5 = [v[4] for v in predictors_]
    x6 = [v[5] for v in predictors_]

    OLS(criterion_, x1, x2, x3, x4, x5, x6)


def plot_ilc_to_ltd():
    numerical_data = json.loads(open('data-trace.json', 'r').read())['data']
    ilc = []
    ltd = []
    for item in numerical_data:
        ilc.append(item['ilc'])
        layout_ = []
        for entry in item['tds']:
            layout_.append((entry[4] + entry[5])/1000)
        layout_.sort(reverse=True)
        ltd.append(sum(layout_[:5]))

    # ilc_n2 = [v**2 for v in ilc]
    ilc_log = [math.log(v) for v in ilc]
    # ilc_log2 = [math.log(v)**2 for v in ilc]
    ilc_log3 = [math.log(v)**3 for v in ilc]
    ilc_nlogn = [v * math.log(v) for v in ilc]
    # ilc_nlogn2 = [v * math.log(v)**2 for v in ilc]
    # ilc_n2logn = [v**2 * math.log(v) for v in ilc]
    # ilc_n2logn2 = [v**2 * math.log(v)**2 for v in ilc]

    # Plot data distribution.
    pyplot.subplot(241)
    pyplot.hist(ilc, bins=40)
    pyplot.title('In-Layout Node Quantity')

    pyplot.subplot(242)
    pyplot.hist(ilc_log, bins=40)
    pyplot.title('Log(ILC)')

    pyplot.subplot(243)
    pyplot.hist(ilc_nlogn, bins=40)
    pyplot.title('nlogn for ILC')

    pyplot.subplot(244)
    pyplot.hist(ilc_log3, bins=40)
    pyplot.title(r'$Log(ILC)^3$')

    pyplot.subplot(245)
    pyplot.scatter(ilc, ltd, s=1)
    pyplot.title('ILC - LTD')

    pyplot.subplot(246)
    pyplot.scatter(ilc_log, ltd, s=1)
    pyplot.title('Log(ILC) - LTD')

    pyplot.subplot(247)
    pyplot.scatter(ilc_nlogn, ltd, s=1)
    pyplot.title('ILC*Log(ILC) - LTD')

    pyplot.subplot(248)
    pyplot.scatter(ilc_log3, ltd, s=1)
    pyplot.title(r'$Log(ILC)^3$ - LTD')

    pyplot.show()


# TODO
# 1. max or sum of top-5? [DONE]
# 2. compute r-value for LR. [DONE]
# 3. understand values. [DONE]
def separated_nonlinear_fitting():
    numerical_data = json.loads(open('data-trace.json', 'r').read())['data']

    image = []
    text = []
    char = []
    ilc = []
    ult = []        # UpdateLayoutTree.
    layout = []

    for item in numerical_data:
        if len(item['tds']) > 0:
            ilc.append(item['ilc'])
            image.append(item['image'])
            text.append(item['text'])
            char.append(item['char'])
            list_ult = []
            list_layout = []
            for arr in item['tds']:
                list_ult.append(arr[4] / 1000)
                list_layout.append(arr[5] / 1000)
            list_ult.sort(reverse=True)
            list_layout.sort(reverse=True)
            ult.append(sum(list_ult[:10]))
            layout.append(sum(list_layout[:10]))

    ilc_log = [math.log(v) for v in ilc]
    ilc_nlogn = [v * math.log(v) for v in ilc]

    predictors = [[ilc[i], ilc_log[i], ilc_nlogn[i], image[i], text[i], char[i]]
                  for i in range(len(ilc))]
    
    layout_sum = [ult[i] + layout[i] for i in range(len(ult))]
    linear_regression_remove_10_percent_outliers(predictors, layout)
    print()
    linear_regression_remove_10_percent_outliers(predictors, ult)
    print()
    linear_regression_remove_10_percent_outliers(predictors, layout_sum)
    

def statistics():
    raw_data = json.loads(open('data-trace.json', 'r').read())['data']
    js = []
    layout = []
    pipeline = []
    render_delay = []
    for entry in raw_data:
        entry_js = []
        entry_layout = []
        entry_pipeline = []
        rd = 0
        for arr in entry['tds']:
            entry_js.append(arr[2] + arr[3])
            entry_layout.append(arr[4] + arr[5])
            entry_pipeline.append(sum(arr[4:]))
            rd += sum(arr)
        js.append(int(sum(entry_js)/1000))
        layout.append(int(sum(entry_layout)/1000))
        pipeline.append(int(sum(entry_pipeline)/1000))
        render_delay.append(int(rd/1000))

    length = len(raw_data)
    rev_count = 0
    layout_percentage = []
    js_percentage_ = []
    layout_percentage_ = []
    pipeline_percentage_ = []
    for i in range(length):
        layout_percentage.append(layout[i] / pipeline[i] if pipeline[i] > 0 else 0)
        js_percentage_.append(js[i] / render_delay[i] if render_delay[i] > 0 else 0)
        layout_percentage_.append(layout[i] / render_delay[i] if render_delay[i] > 0 else 0)
        pipeline_percentage_.append(pipeline[i] / render_delay[i] if render_delay[i] > 0 else 0)
        if js[i] <= pipeline[i]:
            rev_count += 1
    
    print('Cases when pipeline > JS:', rev_count , '/', length, ',', rev_count / length)

    js.sort()
    pipeline.sort()
    layout_percentage.sort()
    layout_percentage_.sort()
    pipeline_percentage_.sort()

    print('JavaScript maximum:', max(js), ',90 percentile:', js[int(length*0.9)], ', median:', js[int(length/2)], ', avg:', numpy.mean(js))
    print('Pipeline maximum:', max(pipeline), ',90 percentile:', pipeline[int(length*0.9)], ', median:', pipeline[int(length/2)], ', avg:', numpy.mean(pipeline))
    print('Layout percentage maximum:', max(layout_percentage), ', median:', layout_percentage[int(length/2)], ', avg:', numpy.mean(layout_percentage))
    print('JS percentage in RD: AVG:', numpy.mean(js_percentage_), ', median:', js_percentage_[int(length/2)])
    print('Layout percentage in RD: AVG:', numpy.mean(layout_percentage_), ', median:', layout_percentage_[int(length/2)])
    print('Pipeline percentage in RD: AVG:', numpy.mean(pipeline_percentage_), ', median:', pipeline_percentage_[int(length/2)])


def totalTaskDurationThread():
    data = json.loads(open('ttd.json', 'r').read())['res']
    axis_font = {'fontname':'Arial', 'size':'16'}
    task = [[], [], []]
    for entry in data:
        task[0].append(entry[0] / 1000)
        task[1].append(entry[1] / 1000)
        task[2].append(entry[2] / 1000)
    # task[0].sort()
    # task[1].sort()
    # task[2].sort()
    l = len(task[0])
    # task[0] = task[0][:int(0.9*l)]
    # task[1] = task[1][:int(0.9*l)]
    # task[2] = task[2][:int(0.9*l)]
    # pyplot.plot(task[0])
    # pyplot.plot(task[1], linestyle='--')
    # pyplot.plot(task[2], linestyle=':')
    # pyplot.legend(['Renderer', 'Compositor', 'Tile Workers'], prop={'size': 16})
    # # pyplot.ylabel('Total Task Duration / ms', axis_font)
    # pyplot.yticks([0, 1000, 2000, 3000], **axis_font)
    # pyplot.ylim(-0.1, 3000)
    # pyplot.xticks([])
    # pyplot.show()
    for i in range(l):
        task[1][i] /= task[0][i] + 1
        task[2][i] /= task[0][i] + 1
    task[1].sort()
    task[2].sort()
    task[1] = task[1][:int(0.9*l)]
    task[2] = task[2][:int(0.9*l)]
    pyplot.plot(task[1])
    pyplot.plot(task[2], linestyle='--')
    # pyplot.hist(task[1], bins=60)
    # pyplot.hist(task[2], bins=60)
    pyplot.legend(['Compositor / Renderer', 'Tile Workers / Renderer'], prop={'size': 16})
    # pyplot.ylabel('Total Task Duration Proportion / %')
    pyplot.xticks([])
    pyplot.yticks([0, 0.04, 0.08, 0.12, 0.16], **axis_font)
    pyplot.show()


def main_top5_sorted_3_13_a():
    legends = ['PH', 'PASS', 'ES', 'FC', 'ULT', 'Layout', 'UL', 'ULrT', 'Paint', 'CL']
    axis_font = {'fontname':'Arial', 'size':'18'}

    raw_data = json.loads(open('data-trace.json', 'r').read())['data']
    tasks = [[] for i in range(len(legends))]
    for entry in raw_data:
        _tasks = [[] for i in range(10)]
        for _entry in entry['tds']:
            for i in range(10):
                _tasks[i].append(_entry[i])
        for i in range(10):
            _tasks[i].sort(reverse=True)
            tasks[i].append(sum(_tasks[i][:5]) / 1000)
    
    for i in range(len(legends)):
        tasks[i].sort()
        tasks[i] = tasks[i][:int(len(tasks[i]) * 0.9)]
    
    linestyles = ['-', '--', '-.', ':']

    for i in range(len(legends)):
        pyplot.plot(tasks[i], linestyle=linestyles[i % len(linestyles)])
    
    pyplot.legend(legends, prop={'size': 14})
    pyplot.xticks([])
    pyplot.yticks([0, 200, 400, 600], **axis_font)
    pyplot.show()


def main_top5_sorted_3_13_b():
    legends = ['HTML', 'CSS', 'JS', 'Layout', 'Layer', 'Paint']
    axis_font = {'fontname':'Arial', 'size':'18'}

    raw_data = json.loads(open('data-trace.json', 'r').read())['data']
    tasks = [[] for _ in range(10)]
    for entry in raw_data:
        _tasks = [[] for i in range(10)]
        for _entry in entry['tds']:
            for i in range(10):
                _tasks[i].append(_entry[i])
        for i in range(10):
            _tasks[i].sort(reverse=True)
            tasks[i].append(sum(_tasks[i][:5]) / 1000)
    agg_tasks = [[] for i in range(6)]
    l = len(tasks[0])
    for i in range(l):
        agg_tasks[0].append(tasks[0][i])    # HTML
        agg_tasks[1].append(tasks[1][i])    # CSS
        agg_tasks[2].append(tasks[2][i] + tasks[3][i])  # JS
        agg_tasks[3].append(tasks[4][i] + tasks[5][i])  # Layout
        agg_tasks[4].append(tasks[6][i] + tasks[7][i] + tasks[9][i])    # Layer
        agg_tasks[5].append(tasks[8][i])    # Paint
    
    for i in range(6):
        agg_tasks[i].sort()
        agg_tasks[i] = agg_tasks[i][:int(l * 0.9)]

    linestyles = ['-', '--', '-.', ':']

    for i in range(len(legends)):
        pyplot.plot(agg_tasks[i], linestyle=linestyles[i % len(linestyles)])
    
    pyplot.legend(legends, prop={'size': 14})
    pyplot.xticks([])
    pyplot.yticks([0, 500, 1000], **axis_font)
    pyplot.show()


def task_proportion_3_14_a():
    legends = ['HTML', 'CSS', 'JS', 'Layout', 'Layer', 'Paint']
    axis_font = {'fontname':'Arial', 'size':'18'}

    raw_data = json.loads(open('data-trace.json', 'r').read())['data']
    tasks = [[] for _ in range(10)]
    for entry in raw_data:
        _tasks = [[] for i in range(10)]
        for _entry in entry['tds']:
            for i in range(10):
                _tasks[i].append(_entry[i])
        for i in range(10):
            _tasks[i].sort(reverse=True)
            tasks[i].append(sum(_tasks[i][:5]) / 1000)
    agg_tasks = [[] for i in range(6)]
    l = len(tasks[0])
    for i in range(l):
        total = 1
        for j in range(10):
            total += tasks[j][i]
        agg_tasks[0].append(tasks[0][i] / total)    # HTML
        agg_tasks[1].append(tasks[1][i] / total)    # CSS
        agg_tasks[2].append((tasks[2][i] + tasks[3][i]) / total)  # JS
        agg_tasks[3].append((tasks[4][i] + tasks[5][i]) / total)  # Layout
        agg_tasks[4].append((tasks[6][i] + tasks[7][i] + tasks[9][i]) / total)    # Layer
        agg_tasks[5].append((tasks[8][i]) / total)    # Paint
    
    for i in range(6):
        agg_tasks[i].sort()
        agg_tasks[i] = agg_tasks[i][:int(l * 0.9)]

    linestyles = ['-', '--', '-.', ':']

    for i in range(len(legends)):
        pyplot.plot(agg_tasks[i], linestyle=linestyles[i % len(linestyles)])
    
    pyplot.legend(legends, prop={'size': 18})
    pyplot.xticks([])
    pyplot.yticks([0, 0.2, 0.4, 0.6, 0.8], **axis_font)
    pyplot.show()


def task_proportion_3_14_b():
    axis_font = {'fontname':'Arial', 'size':'18'}

    data = json.loads(open('data-trace.json', 'r').read())['data']
    tasks = [[] for i in range(10)]
    for entry in data:
        _tasks = [[] for i in range(10)]
        for _entry in entry['tds']:
            for i in range(10):
                _tasks[i].append(_entry[i])
        for i in range(10):
            _tasks[i].sort(reverse=True)
            tasks[i].append(sum(_tasks[i][:5]) / 1000)
    agg_tasks = [[] for i in range(6)]
    l = len(tasks[0])
    for i in range(l):
        agg_tasks[0].append(tasks[0][i])    # HTML
        agg_tasks[1].append(tasks[1][i])    # CSS
        agg_tasks[2].append(tasks[2][i] + tasks[3][i])  # JS
        agg_tasks[3].append(tasks[4][i] + tasks[5][i])  # Layout
        agg_tasks[4].append(tasks[6][i] + tasks[7][i] + tasks[9][i])    # Layer
        agg_tasks[5].append(tasks[8][i])    # Paint
    total = []
    for i in range(l):
        _sum = 0
        for j in range(6):
            _sum += agg_tasks[j][i]
        total.append(_sum)
    for i in range(6):
        for j in range(l):
            agg_tasks[i][j] /= (total[j] + 0.01)
    
    pivot = [[agg_tasks[2][i], i] for i in range(l)]
    pivot.sort(key=lambda arr: arr[0])

    _agg_tasks = [[] for i in range(6)]
    for i in range(l):
        for j in range(6):
            _agg_tasks[j].append(agg_tasks[j][pivot[i][1]])
    
    current_bottom = [0 for i in range(l)]

    pyplot.bar(range(l), _agg_tasks[2], hatch='//')

    for i in range(l):
        current_bottom[i] += _agg_tasks[2][i]
    pyplot.bar(range(l), _agg_tasks[3], bottom=current_bottom, hatch='\\')

    for i in range(l):
        current_bottom[i] += _agg_tasks[3][i]
    pyplot.bar(range(l), _agg_tasks[0], bottom=current_bottom)

    for i in range(l):
        current_bottom[i] += _agg_tasks[0][i]
    pyplot.bar(range(l), _agg_tasks[1], bottom=current_bottom)

    for i in range(l):
        current_bottom[i] += _agg_tasks[1][i]
    pyplot.bar(range(l), _agg_tasks[4], bottom=current_bottom)

    for i in range(l):
        current_bottom[i] += _agg_tasks[4][i]
    pyplot.bar(range(l), _agg_tasks[5], bottom=current_bottom)

    pyplot.legend(['JS', 'Layout', 'HTML', 'CSS', 'Layer', 'Paint'], prop={'size': 18})
    pyplot.xticks([])
    pyplot.yticks([0, 0.5, 1], **axis_font)
    pyplot.show()


def main_sorted_3_15_a():
    legends = ['JS', 'Layout', 'HTML', 'CSS', 'Layer', 'Paint']
    axis_font = {'fontname':'Arial', 'size':'18'}

    raw_data = json.loads(open('data-trace.json', 'r').read())['data']
    tasks = [[] for i in range(len(legends))]
    for entry in raw_data:
        for _entry in entry['tds']:
            tasks[2].append(_entry[0])    # HTML
            tasks[3].append(_entry[1])    # CSS
            tasks[0].append(_entry[2] + _entry[3])  # JS
            tasks[1].append(_entry[4] + _entry[5])  # Layout
            tasks[4].append(_entry[6] + _entry[7] + _entry[9])    # Layer
            tasks[5].append(_entry[8])    # Paint
    
    for i in range(len(legends)):
        tasks[i].sort()
        tasks[i] = tasks[i][:int(len(tasks[i]) * 0.99)]
    
    linestyles = ['-', '--', '-.', ':']

    for i in range(len(legends)):
        pyplot.plot(tasks[i], linestyle=linestyles[i % len(linestyles)])
    
    pyplot.plot(48000, 50000, '^', color='red', markersize=12)
    pyplot.text(35000, 50000, '(95%, 50)', **axis_font)

    pyplot.legend(legends, prop={'size': 18})
    pyplot.xticks([])
    pyplot.yticks([0, 100000, 200000, 300000], ['0', '100', '200', '300'], **axis_font)
    pyplot.show()


def main_stacked_3_15_b():
    axis_font = {'fontname':'Arial', 'size':'18'}

    data = json.loads(open('data-trace.json', 'r').read())['data']
    tasks = [[] for i in range(6)]
    for entry in data:
        for _entry in entry['tds']:
            tasks[2].append(_entry[0])    # HTML
            tasks[3].append(_entry[1])    # CSS
            tasks[0].append(_entry[2] + _entry[3])  # JS
            tasks[1].append(_entry[4] + _entry[5])  # Layout
            tasks[4].append(_entry[6] + _entry[7] + _entry[9])    # Layer
            tasks[5].append(_entry[8])    # Paint
    
    l = len(tasks[0])
    pivot = [[tasks[0][i], i] for i in range(l)]
    pivot.sort(key=lambda arr: arr[0])

    _res = [[] for i in range(6)]
    # l = int(l * 0.99)
    
    for i in range(6):
        for j in range(30000, l):
            _res[i].append(tasks[i][pivot[j][1]] / 1000)
    
    current_bottom = [0 for i in range(l-30000)]
    for i in range(6):
        # _res[i] = [v/1000 for v in _res[i]]
        # tasks[i].sort()
        # tasks[i] = tasks[i][:int(l*0.99)]
        # pyplot.plot(tasks[i])
        if i > 0:
            pyplot.bar(range(l-30000), _res[i], bottom=current_bottom)
        else:
            pyplot.bar(range(l-30000), _res[i])
        
        for j in range(l-30000):
            current_bottom[j] += _res[i][j]
    
    # pyplot.yscale('log')
    # pyplot.plot(48560, 50, 'bo')
    # pyplot.text(38200, 46, '(48560, 50)')
    pyplot.ylim(0, 800)
    pyplot.legend(['JS', 'Layout', 'HTML', 'CSS', 'Layer', 'Paint'], prop={'size':16})
    # pyplot.ylabel('Task Duration in PRD / ms')
    pyplot.xticks([])
    pyplot.yticks([0, 200, 400, 600, 800], **axis_font)
    pyplot.show()


def quantity_dist_scatter_45():
    axis_font = {'fontname':'Arial', 'size':'18'}

    raw_data = json.loads(open('data1.json', 'r').read())['data']
    metadata = [[] for _ in range(4)]
    layout = []
    for entry in raw_data:
        metadata[0].append(entry['metadata'][0])
        metadata[1].append(entry['metadata'][1])
        metadata[2].append(entry['metadata'][2])
        metadata[3].append(entry['metadata'][5])
        _layout = []
        for td in entry['duration']:
            _layout.append((td[4] + td[5])/1000)
        _layout.sort(reverse=True)
        layout.append(sum(_layout[:5]))

    pyplot.subplots_adjust(wspace=0.3)

    pyplot.subplot(241)
    pyplot.plot(sorted(metadata[0]))
    pyplot.title('Node Count', **axis_font)
    pyplot.xticks([])
    pyplot.yticks([0,20000, 40000], ['0', '20k', '40k'], **axis_font)

    pyplot.subplot(242)
    pyplot.plot(sorted(metadata[1]))
    pyplot.title('Image Count', **axis_font)
    pyplot.xticks([])
    pyplot.yticks([0, 400, 800, 1200], **axis_font)

    pyplot.subplot(243)
    pyplot.plot(sorted(metadata[2]))
    pyplot.title('Text Count', **axis_font)
    pyplot.xticks([])
    pyplot.yticks([0, 4000, 8000], **axis_font)

    pyplot.subplot(244)
    pyplot.plot(sorted(metadata[3]))
    pyplot.title('CSS Rule Count', **axis_font)
    pyplot.xticks([])
    pyplot.yticks([0, 500, 1000], **axis_font)

    pyplot.subplot(245)
    pyplot.scatter(metadata[0], layout, s=1)
    pyplot.xticks([10000, 20000, 30000], ['10k', '20k', '30k'], **axis_font)
    pyplot.yticks([0, 500, 1000, 1500], **axis_font)

    pyplot.subplot(246)
    pyplot.scatter(metadata[1], layout, s=1)
    pyplot.xticks([ 400, 800], **axis_font)
    pyplot.yticks([0, 500, 1000, 1500], **axis_font)

    pyplot.subplot(247)
    pyplot.scatter(metadata[2], layout, s=1)
    pyplot.xticks([2500, 5000], **axis_font)
    pyplot.yticks([0, 500, 1000, 1500], **axis_font)

    pyplot.subplot(248)
    pyplot.scatter(metadata[3], layout, s=1)
    pyplot.xticks([ 400, 800], **axis_font)
    pyplot.yticks([0, 500, 1000, 1500], **axis_font)

    pyplot.show()


def long_task_proportion():
    data = json.loads(open('data-trace.json', 'r').read())['data']
    new_data = []
    for entry in data:
        for _entry in entry['tds']:
            new_data.append(int(sum(_entry)/1000))
    l1 = len(new_data)
    long_task = list(filter(lambda v: v > 50, new_data))
    l2 = len(long_task)
    print(l2 / l1)

