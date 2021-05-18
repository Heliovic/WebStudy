const MainThreadDurationalTasks = [
    'ParseHTML',
    'ParseAuthorStyleSheet',
    'EvaluateScript',
    'FunctionCall',
    'UpdateLayoutTree',
    'Layout',
    'UpdateLayer',
    'UpdateLayerTree',
    'Paint',
    'CompositeLayers'
];

const MainThreadInstantTasks = [
    "InvalidateLayout",
    "ScheduleStyleRecalculation"
];

const SideEffectTrigger = [
    "EvaluateScript",
    "FunctionCall",
    "network.mojom.URLLoaderClient"
];

const SideEffectVisualTasks = [
    // "InvalidateLayout",
    "Layout",
    "ParseHTML",
    // "ScheduleStyleRecalculation",
    "UpdateLayoutTree"
];

const ThreadNames = [
    'CrBrowserMain',
    'CrRendererMain',
    'CrGpuMain',
    'NetworkService',
    'ThreadPoolForegroundWorker',
    'Chrome_DevToolsHandlerThread',
    'Chrome_IOThread',
    'Compositor',
    'CompositorTileWorker',
    'VizCompositorThread'
];

class Task {
    constructor(name, ts, dur, data) {
        this.name = name;
        this.ts = ts;
        this.dur = dur;
        this.data = data;

        this.children = [];
    }

    endtime() { return this.ts + this.dur; }
    includes(e) { return this.ts <= e.ts && this.endtime() >= e.endtime(); }

    sort() {
        this.children.sort((a, b) => a.ts - b.ts);
        for (var c of this.children) c.sort();
    }

    isWellFormatted() {
        var res = true;
        for (var c of this.children) {
            if (!this.includes(c)) {
                res = false;
                break;
            }
        }
        if (res && this.children.length > 1) {
            for (var i = 0; i < this.children.length - 1; i++) {
                let c1 = this.children[i];
                let c2 = this.children[i + 1];
                if (c1.endtime() > c2.ts) {
                    res = false;
                    break;
                }
            }
            if (res) {
                for (var c of this.children) {
                    if (!c.isWellFormatted()) {
                        res = false;
                        break;
                    }
                }
            }
        }
        return res;
    }

    beginMainThreadFrame() {
        return this.children.length > 0 &&
            this.children[0].children.length > 0 &&
            this.children[0].children[0].name === 'BeginMainThreadFrame';
    }

    getTaskDuration() {
        var ctd = [];
        for (var i = 0; i < MainThreadDurationalTasks.length; i++) ctd.push(0);

        if (this.children.length > 0) {
            for (let c of this.children) {
                let td_ = c.getTaskDuration();
                for (var i = 0; i < td_.length; i++)
                    ctd[i] += td_[i];
            }
        }

        let idx = MainThreadDurationalTasks.indexOf(this.name);
        if (idx >= 0) {
            ctd[idx] = 0;
            let sum = ctd.reduce((a, b) => a + b);
            ctd[idx] = this.dur - sum;

            // // The side effect of JavaScript evaluation should be as greate as possible,
            // // which means that visibility-irrelevant scripts are very limited.
            // // Otherwise, script evaluation will only block rendering.
            // if (parent &&
            //     SideEffectVisualTasks.indexOf(this.name) >= 0 &&
            //     SideEffectTrigger.indexOf(parent.name) >= 0) {
            //     ctd[MainThreadDurationalTasks.length - 1] += this.dur;
            // }
        }

        return ctd;
    }

    // As we have observed, `Layout` is the most time-consuming rendering task.
    // Yet we need to find out, why and how is `Layout` time-consuming.
    // Data to collect: start, end, caller.
    getLayoutDetails() {
        var ld = [];

        for (var c of this.children) {
            if (c.name === 'Layout')
                ld.push({
                    start: c.ts,
                    dur: c.dur,
                    end: c.endtime(),
                    caller: this.name
                });
            else {
                var cld = c.getLayoutDetails();
                for (var item of cld)
                    ld.push(item);
            }
        }

        return ld;
    }
}

class Thread {
    constructor(id) {
        this.id = id;
        this.name = "";

        this.list = [];
        this.trees = [];
    }

    buildTaskTrees() {
        var dependency = [];
        var leafNodes = new Set();
        var listLength = this.list.length;

        for (var i = 0; i < listLength; i++) dependency.push([]);

        // Uncover dependency.
        for (var i = 0; i < listLength - 1; i++) {
            let t1 = this.list[i];
            for (var j = i + 1; j < listLength; j++) {
                let t2 = this.list[j];
                if (t1.includes(t2)) {
                    dependency[i].push(j);
                    leafNodes.add(j);
                } else if (t2.includes(t1)) {
                    dependency[j].push(i);
                    leafNodes.add(i);
                }
            }
        }

        // Remove multi-hop dependency.
        for (var i in dependency) {
            let inclusion = [...dependency[i]];
            inclusion.forEach(k => {
                dependency[i] = dependency[i].filter(v => !dependency[k].includes(v));
            });
        }

        // Build task trees.
        // var description = new Set();
        for (var i in dependency) {
            for (var j of dependency[i]) {
                // if (MainThreadDurationalTasks.indexOf(this.list[i].name) !== -1)
                // description.add(`${this.list[i].name}->${this.list[j].name}`);

                this.list[i].children.push(this.list[j]);
            }
        }

        for (var i = 0; i < listLength; i++) {
            if (!leafNodes.has(i))
                this.trees.push(this.list[i]);
        }

        dependency = undefined;
        leafNodes = undefined;
        this.list = undefined;

        this.sortTrees();

        // console.log('Task tree well formatted:', this.isWellFormatted());

        // const fs = require('fs');
        // fs.writeFileSync('trees.json', JSON.stringify({ trees: this.trees }));
        // description = Array.from(description);
        // description.sort();
        // fs.writeFileSync('dependency.json', JSON.stringify({ description }));
    }

    sortTrees() {
        this.trees.sort((a, b) => a.ts - b.ts);
        for (var t of this.trees) t.sort();
    }

    isWellFormatted() {
        var res = true;
        for (var i = 0; i < this.trees.length - 1; i++) {
            let t1 = this.trees[i];
            let t2 = this.trees[i + 1];
            if (t1.endtime() > t2.ts) {
                console.log(`Trees: ${i}th node intersects with ${i + 1}th node.`);
                res = false;
                break;
            }
        }
        if (res) {
            for (var i = 0; i < this.trees.length; i++) {
                if (!this.trees[i].isWellFormatted()) {
                    console.log(`Trees: ${i}th node is wrong.`);
                    res = false;
                    break;
                }
            }
        }
        return res;
    }
}

class Process {
    constructor(id) {
        this.id = id;
        this.name = "";

        this.threads = [];
        this.id_to_thread = {};
    }

    addThread(t) {
        this.threads.push(t);
        this.id_to_thread[t.id] = t;
    }
}

class Trace {
    constructor() {
        this.processes = [];
        this.id_to_proc = {};
    }

    addProcess(p) {
        this.processes.push(p);
        this.id_to_proc[p.id] = p;
    }

    saveRendererTaskTrees() {
        const fs = require('fs');
        var count = 0;
        this.processes.forEach(p => {
            p.threads.forEach(t => {
                if (t.name === 'CrRendererMain') {
                    count += 1;
                    t.buildTaskTrees();
                    fs.writeFileSync(`render-trees-${count}.json`, JSON.stringify({ trees: t.trees }));
                }
            });
        });
    }

    taskDurationBeforeFrameUpdate() {
        var res = { td: [] };
        this.processes.forEach(p => {
            p.threads.forEach(t => {
                if (t.name === 'CrRendererMain') {
                    t.buildTaskTrees();
                    // td: Thread Duration. A td contains task durations of a main thread.
                    var td = [];
                    for (var i = 0; i < MainThreadDurationalTasks.length; i++) td.push(0);
                    for (var tree of t.trees) {
                        let td_ = tree.getTaskDuration();
                        for (var i in td_) td[i] += td_[i];
                        if (tree.beginMainThreadFrame()) {
                            res.td.push(td);

                            td = [];
                            for (var i = 0; i < MainThreadDurationalTasks.length; i++) td.push(0);
                        }
                    }
                }
            });
        });
        // return a list of tds
        return res;
    }

    getTop5LayoutDuration() {
        var res = this.taskDurationBeforeFrameUpdate();
        var layout = [];
        for (var i = 0; i < res.td.length; i++) {
            layout.push({ v: res.td[i][4], idx: i });
        }
        layout.sort((a, b) => b.v - a.v);

        var top5 = layout.slice(0, 5);
        var output = [];
        for (var i = 0; i < 5; i++) {
            let sub_tasks = res.ld[top5[i].idx].map(a => parseInt(a.dur / 1000));
            sub_tasks.sort((a, b) => b - a);
            output.push(sub_tasks[0]);
        }

        return output;
    }
}

Trace.parseTrace = function (traceEvents) {
    var trace = new Trace();
    traceEvents.forEach(e => {
        if (!(e.pid && e.tid)) return;

        var process = trace.id_to_proc[e.pid];
        if (!process) {
            process = new Process(e.pid);
            trace.addProcess(process);
        }

        var thread = process.id_to_thread[e.tid];
        if (!thread) {
            thread = new Thread(e.tid);
            process.addThread(thread);
        }

        if (e.cat === '__metadata') {
            if (e.name === 'process_name') {
                process.name = e.args.name;
            } else if (e.name === 'thread_name') {
                thread.name = e.args.name;
            }
        } else {
            var task = new Task(e.name, e.ts, e.dur || 0, e.args || e.args.data);
            thread.list.push(task);
        }
    });

    return trace;
}

module.exports = Trace;

// const fs = require('fs');
// rawData = JSON.parse(fs.readFileSync(process.argv[2]));
// trace = Trace.parseTrace(rawData.traceEvents);
// for (let process of trace.processes) {
//     for (let thread of process.threads) {
//         thread.buildTaskTrees();
//     }
// }
// fs.writeFileSync('trace.json', JSON.stringify(trace));