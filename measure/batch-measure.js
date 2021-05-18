// batch tracing

const EventEmitter = require('events');
const puppeteer = require('puppeteer');
const delay = require('delay');
const fs = require('fs');

process.on('uncaughtException', function(error) {
    console.log(`Uncaught exception: ${error.message}`);
});

process.on('unhandledRejection', function(error) {
    console.log(`Unhandled rejection: ${error.message}`);
});

// URL start points.
var urls = fs.readFileSync('domains-xtd.txt').toString().split('\n');

// URL end points.
var finalURLs = new Set();

function randomFilename() {
    const STRING = "abcdefghijklmnopqrstuvwxyz1234567890";

    var res = "";
    for (var i = 0; i < 15; i++) {
        var c = STRING[Math.floor(Math.random() * STRING.length)];
        res = res + c;
    }

    return res;
}

var i = 0;
var monitor = new EventEmitter();

monitor.on('next', () => {
    if (i >= urls.length) process.exit();
    else {
        i += 1;
        navigate(urls[i], monitor);
    }
});

async function navigate(url) {
    const computedStyles = ['background-image'];

    var browser = await puppeteer.launch({ headless: false });
    var page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });
    await page.setCacheEnabled(false);

    var client = await page.target().createCDPSession();
    await client.send("DOM.enable");
    await client.send("DOMSnapshot.enable");
    await client.send("CSS.enable");

    var cssCount = 0;
    client.on('CSS.styleSheetAdded', () => { cssCount += 1; });

    async function stopCaption() {
        await delay(1000);

        var currentURL = page.url();
        if (finalURLs.has(currentURL)) {
            await page.tracing.stop();
            await client.detach();
            await page.close();
            await browser.close();

            console.log(url, i + 1);
            await delay(1000);

            monitor.emit('next');
        } else {
            finalURLs.add(currentURL);

            try {
                var domss = await client.send('DOMSnapshot.captureSnapshot', { computedStyles });
                var css = await client.send("CSS.stopRuleUsageTracking");

                try {
                    await page.tracing.stop();

                    await delay(100);
                    var data = JSON.parse(fs.readFileSync('trace.json'));
                    data.documents = domss.documents;
                    data.strings = domss.strings;
                    data.ruleUsage = css.ruleUsage;
                    data.cssCount = cssCount;
                    domss = undefined;
                    ruleUsage = undefined;

                    var filename = `forum/${randomFilename()}.json`;
                    while (fs.existsSync(filename)) filename = `forum/${randomFilename()}.json`;
                    fs.writeFileSync(filename, JSON.stringify(data));

                    data = undefined;
                } catch (e) {}

                await client.detach();
                await page.close();
                await browser.close();
            } catch (e) {}

            console.log(url, i + 1);

            await delay(1000);
            monitor.emit('next');
        }
    }

    var timer = setTimeout(async function() {
        stopCaption();
    }, 20000);

    page.on('load', async() => {
        clearTimeout(timer);
        stopCaption();
    });

    await client.send("CSS.startRuleUsageTracking");
    await page.tracing.start({ path: 'trace.json' });

    await delay(100);
    await page.goto(url);
}

navigate(urls[i]);