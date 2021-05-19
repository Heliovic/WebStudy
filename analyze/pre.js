const { extract } = require('../system/util');
const fs = require('fs');
const CrTrace = require('../system/model');

// Output format for each file:
// { 
//    metadata: [nodeCount, imageCount, textCount, cssCount, usedCssCount, cssRuleCount, charCount]
//    duration: [
//        [task1, task2, task3, ...], 
//        [], 
//        [], 
//        ...
//    ]
// }

// Run from base directory.

function v0() {
    var files = fs.readdirSync('../measure/traces/');
    var formatted = [];

    var count = 0;
    for (var f of files) {
        console.log(f);
        let filename = '../measure/traces/' + f;
        let data = JSON.parse(fs.readFileSync(filename));
        // extract data from a raw trace
        let res = extract(data);
        if (typeof(res) != 'undefined') {
            var output = {
                metadata: [
                    res.nodeCount, res.imageCount, res.textCount,
                    res.cssCount, res.usedCssCount, res.cssRuleCount,
                    res.charCount
                ],
                duration: res.taskDurations
            };
            formatted.push(output);
        }
        data = undefined;
        res = undefined;
        output = undefined;
        count += 1;
        console.log(`success: ${count}`);
    }

    fs.writeFileSync('rendering_data_full.json', JSON.stringify({ data: formatted }));
}

function v1() {
    var folder = '../measure/trace/';
    var files = fs.readdirSync(folder);
    var formatted = [];

    for (var f of files) {
        let filename = folder + f;
        let data = JSON.parse(fs.readFileSync(filename));
        let res = extract(data);
        formatted.push({
            image: res.imageCount,
            text: res.textCount,
            char: res.charCount,
            ilc: res.inLayoutCount,
            tds: res.taskDurations
        });
    }

    fs.writeFileSync('data-trace.json', JSON.stringify({ data: formatted }));
}

function totalThreadTaskDuration() {
    var folder = '../measure/trace/';
    var files = fs.readdirSync(folder);
    var threadTaskDuration = [];

    let count = 0;

    for (var f of files) {
        let filename = folder + f;
        let data = JSON.parse(fs.readFileSync(filename));
        var trace = CrTrace.parseTrace(data.traceEvents);

        var output = [0, 0, 0];

        for (let proc of trace.processes) {
            for (let thread of proc.threads) {
                let sum = 0;
                if (thread.name == 'CrRendererMain') {
                    thread.buildTaskTrees();
                    for (let t of thread.trees) sum += t.dur;
                    output[0] += sum;
                } else if (thread.name == 'Compositor') {
                    thread.buildTaskTrees();
                    for (let t of thread.trees) sum += t.dur;
                    output[1] += sum;
                } else if (thread.name.startsWith('CompositorTileWorker')) {
                    thread.buildTaskTrees();
                    for (let t of thread.trees) sum += t.dur;
                    output[2] += sum;
                }
            }
        }

        threadTaskDuration.push(output);
        trace = undefined;

        console.log(count);
        count += 1;
    }

    fs.writeFileSync('ttd.json', JSON.stringify({ res: threadTaskDuration }));
}

v0()

