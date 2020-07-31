const fs = require('fs');
const { CrTrace } = require('./model');

function numericSimilarity(x, y) {
    if (x === y) return 1;
    else return 1 - Math.abs(x - y) / (Math.abs(x) + Math.abs(y));
}

function arrayMeanNumericSimilarity(X, Y) {
    var res = 0;
    for (var i in X) {
        res += numericSimilarity(X[i], Y[i]);
    }
    return Number.parseFloat((res / X.length).toFixed(3));
}

function arraySum(X) {
    return X.reduce((a, b) => {
        return a + b;
    }, 0);
}

function arrayMedian(X) {
    return X[parseInt(X.length / 2)];
}

function arrayMean(X) {
    return arraySum(X) / X.length;
}

function comparePipelineSimilarity(ptd1, ptd2) {
    var res = [];
    for (var i = 0; i < 10; i++) {
        var arr1 = ptd1[i].filter(a => a !== 0).sort();
        var arr2 = ptd2[i].filter(a => a !== 0).sort();
        var l1 = [arr1[0], arrayMedian(arr1), arrayMean(arr1), arr1[arr1.length - 1]];
        var l2 = [arr2[0], arrayMedian(arr2), arrayMean(arr2), arr2[arr2.length - 1]];
        res.push(arrayMeanNumericSimilarity(l1, l2));
    }
    return res;
}

function ptdAverage() {
    var files = fs.readdirSync('traces/').filter(f => f.startsWith(process.argv[2]));
    var res = [];
    for (var f of files) {
        var trace = CrTrace.parseTrace('traces/' + f);
        var ptd = trace.pipelineAnalysis();
        console.log(ptd.length);
        for (var v of ptd) {
            for (var i = 0; i < 10; i++) {
                if (res.length < i + 1)
                    res[i] = v[i];
                else
                    res[i] += v[i];
            }
        }
    }
    for (var i = 0; i < 10; i++)
        res[i] /= files.length;
    console.log(res);
}

ptdAverage();