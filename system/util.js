const puppeteer = require('puppeteer');
const delay = require('delay');
const fs = require('fs');
const Trace = require('./model.js');

async function navigate(url, event, notifier) {
    const computedStyles = ['background-image'];

    var browser = await puppeteer.launch();
    var page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });
    await page.setCacheEnabled(false);

    var client = await page.target().createCDPSession();
    await client.send("DOM.enable");
    await client.send("DOMSnapshot.enable");
    await client.send("CSS.enable");

    var cssCount = 0;
    client.on('CSS.styleSheetAdded', () => { cssCount += 1; });

    page.on('load', async () => {
        var end = Date.now();
        event.reply('asynchronous-reply', { type: 'LOG', data: `Page loaded after ${end - start} ms...` });

        await delay(1000);

        event.reply('asynchronous-reply', { type: 'LOG', data: 'Capturing DOM snapshot...' });
        var domss = await client.send('DOMSnapshot.captureSnapshot', { computedStyles });

        event.reply('asynchronous-reply', { type: 'LOG', data: 'Capturing CSS rule usage...' });
        var css = await client.send("CSS.stopRuleUsageTracking");

        event.reply('asynchronous-reply', { type: 'LOG', data: 'Trace file saved...' })
        await page.tracing.stop();

        event.reply('asynchronous-reply', { type: 'LOG', data: 'Closing headless browser...' });
        await client.detach();
        await page.close();
        await browser.close();

        var data = JSON.parse(fs.readFileSync('trace.json'));
        data.documents = domss.documents;
        data.strings = domss.strings;
        data.ruleUsage = css.ruleUsage;
        data.cssCount = cssCount;
        domss = undefined;
        ruleUsage = undefined;
        fs.unlinkSync('trace.json');

        notifier.emit('DATA', { data, event });
    });

    await client.send("CSS.startRuleUsageTracking");
    await page.tracing.start({ path: 'trace.json' });

    var start = Date.now();
    await page.goto(url);
}

function extract(data) {
    // Metadata.
    var res = extractDataFromDomSnapshot(data.documents, data.strings);
    res.cssCount = data.cssCount;
    res.cssRuleCount = data.ruleUsage.length;

    var usedCss = new Set();
    for (var i = 0; i < data.ruleUsage.length; i++) {
        usedCss.add(data.ruleUsage[i].styleSheetId);
    }
    res.usedCssCount = usedCss.size;

    // Render data.
    var taskTrace = Trace.parseTrace(data.traceEvents);
    res.taskDurations = taskTrace.taskDurationBeforeFrameUpdate().td;   // microseconds

    return res;
}

function extractDataFromDomSnapshot(documents, strings) {
    var doc = documents[0];
    var res = {
        nodeCount: doc.nodes.parentIndex.length,
        imageCount: 0,
        textCount: 0
    };

    var layoutCount = doc.layout.nodeIndex.length;
    for (var i = 0; i < layoutCount; i++) {
        var idx = doc.layout.nodeIndex[i];
        var nameIndex = doc.nodes.nodeName[idx];
        if (nameIndex >= 0 && strings[nameIndex].toUpperCase() === 'IMG') {
            res.imageCount += 1;
        } else {
            var styleIndex = doc.layout.styles[i][0];
            if (styleIndex >= 0 &&
                strings[styleIndex].toUpperCase() !== 'NONE' &&
                strings[styleIndex].startsWith('url')) {
                res.imageCount += 1;
            }
        }
    }

    var texts = doc.layout.text.filter(idx => idx !== -1);
    texts = texts.map(idx => strings[idx]);
    res.textCount = texts.length;
    res.textSegCount = doc.textBoxes.layoutIndex.length;

    return res;
}

module.exports = { navigate, extract };