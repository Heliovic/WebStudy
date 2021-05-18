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
var tmp = fs.readFileSync('../alexa500/alexa500.txt').toString().split('\r\n');
var urls = []

tmp.forEach(e => {
    if (e != '') {
        urls.push(e)
    }
});

console.log(urls);

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
console.log(urls.length)

monitor.on('next', () => {
    if (i >= urls.length) process.exit();
    else {
        i += 1;
        navigate(urls[i], monitor);
    }
});

async function navigate(url) {

    var domain = url;

    if (fs.existsSync(`traces/${domain}.json`)) {
        console.log(url, i + 1);
        monitor.emit('next');
        return;
    }
    
    url = 'https://' + url;
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

    var stopped = false;

    async function stopCaption() {
        // await delay(1000);
        if (stopped) {
            return;
        }

        try {
            var currentURL = page.url();
            if (finalURLs.has(currentURL)) {
                await page.tracing.stop();
                await client.detach();
                await page.close();
                await browser.close();

                // console.log(url, i + 1);
                // await delay(1000);

                // monitor.emit('next');
            } else {
                finalURLs.add(currentURL);

                var domss = await client.send('DOMSnapshot.captureSnapshot', { computedStyles });
                var css = await client.send("CSS.stopRuleUsageTracking");

                await page.tracing.stop();

                await delay(100);
                
                try {
                    var data = JSON.parse(fs.readFileSync(`traces/${domain}.json`));
                    data.documents = domss.documents;
                    data.strings = domss.strings;
                    data.ruleUsage = css.ruleUsage;
                    data.cssCount = cssCount;
                    domss = undefined;
                    ruleUsage = undefined;

                    var filename = `traces/${domain}.json`;
                    // while (fs.existsSync(filename)) filename = `traces/${domain}.json`;
                    fs.writeFileSync(filename, JSON.stringify(data));

                    data = undefined;
                } catch (e) {
                    console.log(e)
                }

                await client.detach();
                await page.close();
                await browser.close();
            }
        } catch (e) {
            console.log(e);
        } finally {
            if (!stopped) {
                console.log(url, i + 1);
                monitor.emit('next');
                stopped = true;
            }
            try {
                await page.tracing.stop();
            } catch (error) { }
            try {
                await client.detach();
            } catch (error) { }
            try {
                await page.close();
            } catch (error) { }
            try {
                await browser.close();
            } catch (error) { }
        }
    }

    var timer = setTimeout(async function() {
        stopCaption();
    }, 20000);

    page.on('load', async() => {
        clearTimeout(timer);
        stopCaption();
    });

    try {
        await client.send("CSS.startRuleUsageTracking");
        await page.tracing.start({ path: `traces/${domain}.json` });

        await delay(100);
        await page.goto(url);
    } catch (e) {
        console.log(e);
        clearTimeout(timer);
        stopCaption();
    }
}

navigate(urls[i]);