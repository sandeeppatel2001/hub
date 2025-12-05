/**
 * Domain Similarity and Typosquatting Detection
 * Detects similar domains that could be used for phishing
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Calculate similarity percentage between two domains
 * @param {string} domain1 - First domain
 * @param {string} domain2 - Second domain
 * @returns {number} - Similarity percentage (0-100)
 */
function calculateSimilarity(domain1, domain2) {
    const distance = levenshteinDistance(domain1, domain2);
    const maxLength = Math.max(domain1.length, domain2.length);
    return ((maxLength - distance) / maxLength) * 100;
}

/**
 * Common homoglyphs (look-alike characters)
 */
const HOMOGLYPHS = {
    'a': ['а', 'ɑ', 'α'],
    'e': ['е', 'ė', 'ē'],
    'i': ['і', 'ı', 'l', '1'],
    'o': ['о', '0', 'ο'],
    'p': ['р', 'ρ'],
    'c': ['с', 'ϲ'],
    'x': ['х', '×'],
    'y': ['у', 'ү'],
    'n': ['ո', 'ռ'],
    'm': ['м', 'ṃ']
};

/**
 * Detect homoglyph attacks in domain
 * @param {string} suspiciousDomain - Domain to check
 * @param {string} legitimateDomain - Known legitimate domain
 * @returns {boolean} - True if homoglyph detected
 */
function detectHomoglyph(suspiciousDomain, legitimateDomain) {
    // Normalize both domains
    const suspicious = suspiciousDomain.toLowerCase().replace('.onion', '');
    const legitimate = legitimateDomain.toLowerCase();

    if (suspicious === legitimate) return false;

    // Check if suspicious domain could be created using homoglyphs
    for (let i = 0; i < legitimate.length; i++) {
        const char = legitimate[i];
        if (HOMOGLYPHS[char]) {
            for (const homoglyph of HOMOGLYPHS[char]) {
                const variant = legitimate.substring(0, i) + homoglyph + legitimate.substring(i + 1);
                if (suspicious.includes(variant)) {
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Detect typosquatting patterns
 * @param {string} suspiciousDomain - Domain to check
 * @param {string} legitimateDomain - Known legitimate domain
 * @returns {object} - Detection result with type and confidence
 */
function detectTyposquatting(suspiciousDomain, legitimateDomain) {
    const suspicious = suspiciousDomain.toLowerCase().replace('.onion', '');
    const legitimate = legitimateDomain.toLowerCase();

    const result = {
        isTyposquatting: false,
        type: null,
        confidence: 0
    };

    // Exact match
    if (suspicious === legitimate) {
        return result;
    }

    // Character omission (e.g., gogle.com)
    if (suspicious.length === legitimate.length - 1) {
        for (let i = 0; i < legitimate.length; i++) {
            const variant = legitimate.substring(0, i) + legitimate.substring(i + 1);
            if (suspicious === variant) {
                result.isTyposquatting = true;
                result.type = 'character_omission';
                result.confidence = 95;
                return result;
            }
        }
    }

    // Character addition (e.g., googgle.com)
    if (suspicious.length === legitimate.length + 1) {
        for (let i = 0; i <= legitimate.length; i++) {
            for (let c = 97; c <= 122; c++) { // a-z
                const variant = legitimate.substring(0, i) + String.fromCharCode(c) + legitimate.substring(i);
                if (suspicious === variant) {
                    result.isTyposquatting = true;
                    result.type = 'character_addition';
                    result.confidence = 90;
                    return result;
                }
            }
        }
    }

    // Character swap (e.g., googel.com)
    if (suspicious.length === legitimate.length) {
        for (let i = 0; i < legitimate.length - 1; i++) {
            const variant = legitimate.substring(0, i) +
                legitimate[i + 1] +
                legitimate[i] +
                legitimate.substring(i + 2);
            if (suspicious === variant) {
                result.isTyposquatting = true;
                result.type = 'character_swap';
                result.confidence = 95;
                return result;
            }
        }
    }

    // Homoglyph detection
    if (detectHomoglyph(suspicious, legitimate)) {
        result.isTyposquatting = true;
        result.type = 'homoglyph';
        result.confidence = 85;
        return result;
    }

    // High similarity (Levenshtein)
    const similarity = calculateSimilarity(suspicious, legitimate);
    if (similarity > 80) {
        result.isTyposquatting = true;
        result.type = 'high_similarity';
        result.confidence = similarity;
        return result;
    }

    return result;
}

/**
 * Check if onion domain is similar to company brand
 * @param {string} onionDomain - Onion domain to check
 * @param {array} brandKeywords - Array of brand keywords
 * @returns {object} - Match result
 */
function checkBrandSimilarity(onionDomain, brandKeywords) {
    const domain = onionDomain.toLowerCase().replace('.onion', '');

    for (const keyword of brandKeywords) {
        const brand = keyword.toLowerCase();

        // Direct match
        if (domain.includes(brand)) {
            return {
                match: true,
                keyword: keyword,
                type: 'direct_match',
                confidence: 100
            };
        }

        // Typosquatting
        const typoResult = detectTyposquatting(domain, brand);
        if (typoResult.isTyposquatting) {
            return {
                match: true,
                keyword: keyword,
                type: typoResult.type,
                confidence: typoResult.confidence
            };
        }
    }

    return { match: false };
}

module.exports = {
    levenshteinDistance,
    calculateSimilarity,
    detectHomoglyph,
    detectTyposquatting,
    checkBrandSimilarity
};
