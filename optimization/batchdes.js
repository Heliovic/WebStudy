const fs = require('fs');

const NODE_TYPE = ['Element', 'Attr', 'Text', 'CDATASection', 'EntityReference',
    'Entity', 'ProcessingInstruction', 'Comment', 'Document', 'DocumentType',
    'DocumentFragment', 'Notation'];

class CoordinateNode {
    constructor(type, name, value, dindex, index, bounds) {
        // DOM attributes.
        this.type = type;       // Node type, integer.
        this.name = name;       // Node name, string.
        this.value = value;     // NodeValue | TextValue | InputValue, string.

        this.dindex = dindex;   // Index in the DOM tree.
        this.index = index;     // Index in the node list.

        // Post-layout coordinates.
        this.bounds = bounds;
        this.x = bounds[0];
        this.y = bounds[1];
        this.width = bounds[2];
        this.height = bounds[3];
        this.spanX = this.x + this.width;
        this.spanY = this.y + this.height;

        // Used in relative similarity.
        this.pivotX = 0;
        this.pivotY = 0;

        // Geographically internal nodes. Stores indexes.
        this.innerNodes = [];
    }
}

function determineElementSimilarity(documents, strings) {
    var doc = documents[0];

    // Allocate CoordinateNodes from DOM snapshot.
    function getString(idx) {
        return (idx < 0 || idx >= strings.length) ? '' : strings[idx];
    }

    var nodes = [];
    for (let i = 0; i < doc.layout.nodeIndex.length; i++) {
        let dindex = doc.layout.nodeIndex[i];
        let type = NODE_TYPE[doc.nodes.nodeType[dindex]];
        let name = getString(doc.nodes.nodeName[dindex]);
        let value = getString(doc.nodes.nodeValue[dindex]) |
            getString(doc.nodes.textValue[dindex]) |
            getString(doc.nodes.inputValue[dindex]);
        let bounds = doc.layout.bounds[i];

        var n = new CoordinateNode(type, name, value, dindex, i, bounds);
        if (n.width > 0 && n.height > 0) nodes.push(n);
    }

    // console.log(`\tActual in Layout node: ${nodes.length}.`);

    // Discover direct coordinate coverage.
    function covers(i, j) {
        return nodes[i].x <= nodes[j].x &&
            nodes[i].y <= nodes[j].y &&
            nodes[i].x + nodes[i].width >= nodes[j].x + nodes[j].width &&
            nodes[i].y + nodes[i].height >= nodes[j].y + nodes[j].height;
    }

    var inclusion = [];
    for (var i = 0; i < nodes.length; i++)
        inclusion.push([]);

    for (var i = 0; i < nodes.length - 1; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
            if (covers(i, j))
                inclusion[i].push(j);
            else if (covers(j, i))
                inclusion[j].push(i);
        }
    }

    for (var i in inclusion) {
        if (inclusion[i].length > 0) {
            let entry = [...inclusion[i]];
            entry.forEach(k => {
                inclusion[i] = inclusion[i].filter(v => !inclusion[k].includes(v));
            })
        }

        nodes[i].innerNodes = [...inclusion[i]];
        for (var j of inclusion[i]) {
            nodes[j].pivotX = nodes[i].x;
            nodes[j].pivotY = nodes[i].y;
        }
    }

    // Determine same-genre relationship.
    var absoluteSimilarity = [];          // Default 0, True 1, False -1.
    var relativeSimilarity = [];          // Default 0, True 1, False -1.
    for (var i = 0; i < nodes.length; i++) {
        var entry = [];
        for (var j = 0; j < nodes.length; j++)
            entry.push(0);
        absoluteSimilarity.push(entry);
        relativeSimilarity.push([...entry]);
    }

    // 8px is the HTML's default margin.
    // Here we take half this margin as minimum offset.
    const MIN_OFFSET = 4;
    function closeCoordinates(i, j, abs) {
        // Check absolute close coordinates.
        if (abs) {
            // s1 = nodes[i].width * nodes[i].height;
            // s2 = nodes[j].width * nodes[j].height;
            // similarSize = (s1 > s2 ? s2 / s1 : s1 / s2) >= 0.9;
            sameRow = Math.abs(nodes[i].x - nodes[j].x) <= MIN_OFFSET && Math.abs(nodes[i].spanX - nodes[j].spanX) <= MIN_OFFSET;
            sameColumn = Math.abs(nodes[i].y - nodes[j].y) <= MIN_OFFSET && Math.abs(nodes[i].spanY - nodes[j].spanY) <= MIN_OFFSET;
            similarSize = Math.abs(nodes[i].width - nodes[j].width) <= MIN_OFFSET && Math.abs(nodes[i].height - nodes[j].height) <= MIN_OFFSET;

            return similarSize && (sameRow || sameColumn);
        }
        // Check relative close coordinates.
        else {
            return Math.abs(nodes[i].width - nodes[j].width) <= MIN_OFFSET &&
                Math.abs(nodes[i].height - nodes[j].height) <= MIN_OFFSET &&
                Math.abs(nodes[i].x - nodes[i].pivotX - nodes[j].x + nodes[j].pivotX) <= MIN_OFFSET &&
                Math.abs(nodes[i].y - nodes[i].pivotY - nodes[j].y + nodes[j].pivotY) <= MIN_OFFSET;
        }
    }

    // Two elements are ident1ified as of same genre when:
    // 1. they are displayed in a same row or column, and
    // 2. they have similar sizes, and
    // 3. they have similar inner structure, or
    // 4. they share another element that is of same genre (transitivity).

    // Determine the similarity between outer nodes.
    function getAbsoluteSimilarity(i, j) {
        if (absoluteSimilarity[i][j] !== 0) return absoluteSimilarity[i][j];

        if (closeCoordinates(i, j, true)) {
            // Outer shapes are similar, then compares their inner structures.
            if (nodes[i].innerNodes.length !== nodes[j].innerNodes.length) return -1;
            if (nodes[i].innerNodes.length === 0) return 1;

            let target = new Set(nodes[j].innerNodes);
            for (let i_ of nodes[i].innerNodes) {
                let matchFound = false;
                for (let j_ of target) {
                    let rs = getRelativeSimilarity(i_, j_);
                    relativeSimilarity[i_][j_] = rs;
                    relativeSimilarity[j_][i_] = rs;

                    if (rs === 1) {
                        matchFound = true;
                        target.delete(j_);
                        break;
                    }
                }
                if (!matchFound) return -1;
            }
            return 1;
        }
        else
            return -1;
    }

    // Determine the similarity between inner structures.
    function getRelativeSimilarity(i, j) {
        if (absoluteSimilarity[i][j] === 1) return 1;
        if (relativeSimilarity[i][j] !== 0) return relativeSimilarity[i][j];

        if (closeCoordinates(i, j, false)) {
            if (nodes[i].innerNodes.length !== nodes[j].innerNodes.length) return -1;
            if (nodes[i].innerNodes.length === 0) return 1;

            let target = new Set(nodes[j].innerNodes);
            for (let i_ of nodes[i].innerNodes) {
                matchFound = false;
                for (let j_ of target) {
                    let rs = getRelativeSimilarity(i_, j_);
                    relativeSimilarity[i_][j_] = rs;
                    relativeSimilarity[j_][i_] = rs;

                    if (rs === 1) {
                        matchFound = true;
                        target.delete(j_);
                        break;
                    }
                }
                if (!matchFound) return -1;
            }
            return 1;
        }
        else return -1;
    }

    count_ = 0;
    for (var i = 0; i < nodes.length - 1; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
            let as = getAbsoluteSimilarity(i, j)
            absoluteSimilarity[i][j] = as;
            absoluteSimilarity[j][i] = as;

            if (as === 1) count_ += 1;
        }
    }
    // console.log(`\tSimilarity computed: ${count_}.`);

    // Check transitivity.
    // for (let i = 0; i < nodes.length - 1; i++) {
    //     for (let j = i + 1; j < nodes.length; j++) {
    //         if (absoluteSimilarity[i][j] !== 1) {
    //             for (let k = 0; k < nodes.length; k++) {
    //                 if (k !== i && k !== j &&
    //                     absoluteSimilarity[i][k] === 1 &&
    //                     absoluteSimilarity[k][j] === 1) {
    //                     absoluteSimilarity[i][j] = 1;
    //                     absoluteSimilarity[j][i] = 1;
    //                     break;
    //                 }
    //             }
    //         }
    //     }
    // }
    // console.log('Transitivity checked.');

    // Aggregate similarity information.
    var clusters = [];
    for (let i = 0; i < nodes.length - 1; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            if (absoluteSimilarity[i][j] === 1) {
                destinationFound = false;
                for (let cl of clusters) {
                    if (cl.includes(i) && !cl.includes(j)) {
                        destinationFound = true;
                        cl.push(j);
                        break;
                    }
                    else if (cl.includes(j) && !cl.includes(i)) {
                        destinationFound = true;
                        cl.push(i);
                        break;
                    }
                    else if (cl.includes(i) && cl.includes(j)) {
                        destinationFound = true;
                        break;
                    }
                }
                if (!destinationFound) {
                    let cl = [i, j];
                    clusters.push(cl);
                }
            }
        }
    }

    // Determine cluster containing relationship.
    // Contained clusters are removed from return value.
    // One cluster contains another cluster, only if:
    // Every element in the latter cluster is covered by one element in the former cluster.
    var top = new Set();        // Index of top-level clusters.
    for (let i = 0; i < clusters.length; i++) top.add(i);

    function containCluster(i, j) {
        for (let j_ of clusters[j]) {
            let topFound = false;
            for (let i_ of clusters[i]) {
                if (nodes[i_].x <= nodes[j_].x &&
                    nodes[i_].y <= nodes[j_].y &&
                    nodes[i_].spanX >= nodes[j_].spanX &&
                    nodes[i_].spanY >= nodes[j_].spanY) {
                    topFound = true;
                    break;
                }
            }
            if (!topFound) return false;
        }
        return true;
    }

    for (let i = 0; i < clusters.length - 1; i++) {
        if (!top.has(i)) continue;
        for (let j = i + 1; j < clusters.length; j++) {
            if (!top.has(j)) continue;
            if (containCluster(i, j)) top.delete(j);
            else if (containCluster(j, i)) {
                top.delete(i);
                break;
            }
        }
    }

    // console.log(`\tTop-level clusters computed: ${top.size}/${clusters.length}.`);

    // top ----> clusters ----> nodes.
    return { nodes, clusters, top };
}

function batchDES() {
    var folder = '../measure/trace/';
    var files = fs.readdirSync(folder);
    var output = [];

    // For each trace file, ouput：
    //   1. Quantity of elements in each cluster;
    //   2. Total covering area of each cluster.
    // Data form: { eq: [], tca: [] }.

    let count = 0;
    for (var f of files) {
        let filename = folder + f;
        let data = JSON.parse(fs.readFileSync(filename));

        let start = Date.now();
        let result = determineElementSimilarity(data.documents, data.strings);
        let end = Date.now();

        // let singleNodes = new Set();
        // for (let i = 0; i < result.nodes.length; i++) singleNodes.add(i);
        // for (let cl of result.clusters)
        //     for (let idx of cl)
        //         singleNodes.delete(idx);

        let eq = [], tca = [];
        for (let ci of result.top) {
            eq.push(result.clusters[ci].length);
            let s = 0;
            for (let idx of result.clusters[ci]) {
                s += result.nodes[idx].width * result.nodes[idx].height;
            }
            tca.push(s);
        }
        // for (let idx of singleNodes) {
        //     eq.push(1);
        //     tca.push(result.nodes[idx].width * result.nodes[idx].height);
        // }
        output.push({ eq, tca });

        data = undefined;
        result = undefined;

        count += 1;
        console.log(filename, end - start, count);
    }

    fs.writeFileSync('des.json', JSON.stringify({ data: output }));
}

function clusterByClassName(document, strings) {
    class DOMNode {
        constructor(cns, bounds) {
            this.classNames = cns;
            this.bounds = bounds;
        }
    }

    var layoutNodes = [];
    for (let i = 0; i < document.layout.nodeIndex.length; i++) {
        var nodeIndex = document.layout.nodeIndex[i];

        var fullnames = [];
        var attributeFound = false;
        for (let j = 0; j < document.nodes.attributes[nodeIndex].length; j++) {
            if (strings[document.nodes.attributes[nodeIndex][j]] === 'class') {
                let cns = strings[document.nodes.attributes[nodeIndex][j + 1]];
                if (cns) {
                    fullnames = cns.trim().split(/\s+/);
                    attributeFound = true;
                }
            }
        }

        if (!attributeFound) {
            var suffix = strings[document.nodes.nodeName[nodeIndex]].replace(' ', '');
            var parentIndex = document.nodes.parentIndex[nodeIndex];
            let classedParentFound = false;
            while (parentIndex >= 0) {
                for (let j = 0; j < document.nodes.attributes[parentIndex].length; j++) {
                    if (strings[document.nodes.attributes[parentIndex][j]] === 'class') {
                        let cns = strings[document.nodes.attributes[parentIndex][j + 1]];
                        if (cns) {
                            for (let cn of cns.trim().split(/\s+/))
                                fullnames.push(cn + ' ' + suffix);
                            classedParentFound = true;
                            break;
                        }
                    }
                }
                if (classedParentFound) break;
                else {
                    suffix = strings[document.nodes.nodeName[parentIndex]].replace(' ', '') + ' ' + suffix;
                    parentIndex = document.nodes.parentIndex[parentIndex];
                }
            }

            if (!classedParentFound) fullnames.push(suffix);
        }

        var node = new DOMNode(fullnames, document.layout.bounds[i]);
        layoutNodes.push(node);
    }

    var allClassNames = [];
    var simpleClusters = [];
    for (let ln of layoutNodes) {
        for (let name of ln.classNames) {
            var idx = allClassNames.indexOf(name);
            if (idx >= 0) simpleClusters[idx].push(ln);
            else {
                allClassNames.push(name);
                simpleClusters.push([ln]);
            }
        }
    }

    var stats = [];

    for (let i = 0; i < allClassNames.length; i++) {
        stats.push([i, allClassNames[i], simpleClusters[i].length]);
    }

    stats.sort((a, b) => b[2] - a[2]);

    console.log('Maximum cluster size:', stats[0][2], ', Class name:', stats[0][1], '.');

    return { allClassNames, simpleClusters };
}

function batchCCN() {
    var folder = '../measure/trace/';
    var files = fs.readdirSync(folder);
    var output = [];

    for (var f of files) {
        let filename = folder + f;
        let data = JSON.parse(fs.readFileSync(filename));

        let res = clusterByClassName(data.documents[0], data.strings);
        output.push(res);
    }

    fs.writeFileSync('ccn.json', JSON.stringify({ data: output }));
}

batchCCN();