/**
 * HTML Similarity Detection
 * Compares HTML structure for phishing site detection
 */

const cheerio = require('cheerio');

/**
 * Extract structural features from HTML
 * @param {string} html - HTML content
 * @returns {object} - Structural features
 */
function extractStructuralFeatures(html) {
    const $ = cheerio.load(html);

    const features = {
        title: $('title').text().trim(),
        formCount: $('form').length,
        inputFields: [],
        cssClasses: [],
        ids: [],
        links: [],
        images: []
    };

    // Extract form input fields
    $('input').each((i, elem) => {
        const type = $(elem).attr('type') || 'text';
        const name = $(elem).attr('name') || '';
        const id = $(elem).attr('id') || '';
        features.inputFields.push({ type, name, id });
    });

    // Extract CSS classes (top 20 most common)
    const classMap = {};
    $('[class]').each((i, elem) => {
        const classes = $(elem).attr('class').split(' ');
        classes.forEach(cls => {
            if (cls) classMap[cls] = (classMap[cls] || 0) + 1;
        });
    });
    features.cssClasses = Object.keys(classMap)
        .sort((a, b) => classMap[b] - classMap[a])
        .slice(0, 20);

    // Extract IDs
    $('[id]').each((i, elem) => {
        const id = $(elem).attr('id');
        if (id) features.ids.push(id);
    });

    // Extract links
    $('a[href]').each((i, elem) => {
        features.links.push($(elem).attr('href'));
    });

    // Extract image sources
    $('img[src]').each((i, elem) => {
        features.images.push($(elem).attr('src'));
    });

    return features;
}

/**
 * Calculate Jaccard similarity between two sets
 * @param {array} set1 - First set
 * @param {array} set2 - Second set
 * @returns {number} - Similarity (0-1)
 */
function jaccardSimilarity(set1, set2) {
    const s1 = new Set(set1);
    const s2 = new Set(set2);

    const intersection = new Set([...s1].filter(x => s2.has(x)));
    const union = new Set([...s1, ...s2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
}

/**
 * Compare two HTML structures
 * @param {string} html1 - First HTML
 * @param {string} html2 - Second HTML
 * @returns {object} - Similarity scores
 */
function compareHtmlStructure(html1, html2) {
    const features1 = extractStructuralFeatures(html1);
    const features2 = extractStructuralFeatures(html2);

    // Compare form inputs (critical for login pages)
    const inputSimilarity = compareInputFields(features1.inputFields, features2.inputFields);

    // Compare CSS classes
    const cssSimilarity = jaccardSimilarity(features1.cssClasses, features2.cssClasses);

    // Compare IDs
    const idSimilarity = jaccardSimilarity(features1.ids, features2.ids);

    // Compare title
    const titleSimilarity = features1.title === features2.title ? 1 :
        (features1.title.includes(features2.title) ||
            features2.title.includes(features1.title) ? 0.5 : 0);

    // Weighted overall similarity
    const overallSimilarity = (
        inputSimilarity * 0.4 +
        cssSimilarity * 0.3 +
        idSimilarity * 0.2 +
        titleSimilarity * 0.1
    ) * 100;

    return {
        overall: Math.round(overallSimilarity),
        inputFields: Math.round(inputSimilarity * 100),
        cssClasses: Math.round(cssSimilarity * 100),
        ids: Math.round(idSimilarity * 100),
        title: Math.round(titleSimilarity * 100)
    };
}

/**
 * Compare input fields between two forms
 * @param {array} inputs1 - First form inputs
 * @param {array} inputs2 - Second form inputs
 * @returns {number} - Similarity (0-1)
 */
function compareInputFields(inputs1, inputs2) {
    if (inputs1.length === 0 && inputs2.length === 0) return 0;

    // Compare input types
    const types1 = inputs1.map(i => i.type).sort();
    const types2 = inputs2.map(i => i.type).sort();
    const typeSimilarity = jaccardSimilarity(types1, types2);

    // Compare input names
    const names1 = inputs1.map(i => i.name).filter(n => n);
    const names2 = inputs2.map(i => i.name).filter(n => n);
    const nameSimilarity = jaccardSimilarity(names1, names2);

    // Compare input IDs
    const ids1 = inputs1.map(i => i.id).filter(id => id);
    const ids2 = inputs2.map(i => i.id).filter(id => id);
    const idSimilarity = jaccardSimilarity(ids1, ids2);

    return (typeSimilarity * 0.4 + nameSimilarity * 0.3 + idSimilarity * 0.3);
}

/**
 * Detect if HTML contains login form
 * @param {string} html - HTML content
 * @returns {boolean} - True if login form detected
 */
function hasLoginForm(html) {
    const $ = cheerio.load(html);
    const text = $('body').text().toLowerCase();

    // Check for password input
    const hasPasswordInput = $('input[type="password"]').length > 0;

    // Check for login keywords
    const hasLoginKeywords = /login|sign in|log in|signin|authenticate/i.test(text);

    // Check for username/email input
    const hasUsernameInput = $('input[type="email"], input[name*="user"], input[name*="email"]').length > 0;

    return hasPasswordInput && (hasLoginKeywords || hasUsernameInput);
}

module.exports = {
    extractStructuralFeatures,
    compareHtmlStructure,
    hasLoginForm,
    jaccardSimilarity
};
