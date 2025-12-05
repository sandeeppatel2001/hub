/**
 * Alert Severity Scoring and Management
 * Provides functions to score, prioritize, and format alerts
 */

const fs = require('fs');
const path = require('path');

/**
 * Calculate severity score for a finding
 * @param {object} finding - The finding object
 * @returns {number} - Severity score (1-10)
 */
function calculateSeverity(finding) {
    let score = 0;

    // Base score by type
    const typeScores = {
        'credential_leak': 8,
        'brand_impersonation': 7,
        'ransomware_leak': 10,
        'insider_threat': 9,
        'vulnerability': 7,
        'social_media_threat': 5
    };

    score = typeScores[finding.type] || 5;

    // Adjust based on data sensitivity
    if (finding.evidence) {
        if (finding.evidence.passwords && finding.evidence.passwords.length > 0) score += 2;
        if (finding.evidence.apiKeys && finding.evidence.apiKeys.length > 0) score += 1;
        if (finding.evidence.adminEmails && finding.evidence.adminEmails.length > 0) score += 1;
        if (finding.evidence.countdown) score += 2; // Ransomware countdown
    }

    // Adjust based on recency (newer = higher)
    if (finding.timestamp) {
        const age = Date.now() - new Date(finding.timestamp).getTime();
        const daysSinceFound = age / (1000 * 60 * 60 * 24);

        if (daysSinceFound < 1) score += 1;
        else if (daysSinceFound > 30) score -= 1;
    }

    // Cap at 10
    return Math.min(10, Math.max(1, score));
}

/**
 * Get severity label from score
 * @param {number} score - Severity score
 * @returns {string} - Severity label
 */
function getSeverityLabel(score) {
    if (score >= 9) return 'CRITICAL';
    if (score >= 7) return 'HIGH';
    if (score >= 4) return 'MEDIUM';
    return 'LOW';
}

/**
 * Format alert for output
 * @param {object} finding - The finding object
 * @returns {object} - Formatted alert
 */
function formatAlert(finding) {
    const severity = calculateSeverity(finding);
    const label = getSeverityLabel(severity);

    return {
        ...finding,
        severity,
        severityLabel: label,
        formattedTimestamp: new Date(finding.timestamp).toISOString()
    };
}

/**
 * Save alert to appropriate report directory
 * @param {object} alert - The alert object
 * @param {string} featureName - Feature name (e.g., 'credential_leaks')
 */
function saveAlert(alert, featureName) {
    const reportDir = path.join(__dirname, '../../reports', featureName);

    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    const filename = `${featureName}_${Date.now()}.json`;
    const filepath = path.join(reportDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(alert, null, 2));
    console.log(`[+] Alert saved: ${filepath}`);
}

/**
 * Generate consolidated report from multiple findings
 * @param {array} findings - Array of findings
 * @param {string} featureName - Feature name
 * @param {string} companyName - Company name
 * @returns {object} - Consolidated report
 */
function generateReport(findings, featureName, companyName) {
    const formattedFindings = findings.map(formatAlert);

    const criticalCount = formattedFindings.filter(f => f.severity >= 9).length;
    const highCount = formattedFindings.filter(f => f.severity >= 7 && f.severity < 9).length;
    const mediumCount = formattedFindings.filter(f => f.severity >= 4 && f.severity < 7).length;
    const lowCount = formattedFindings.filter(f => f.severity < 4).length;

    return {
        feature: featureName,
        companyName,
        scanDate: new Date().toISOString(),
        totalFindings: findings.length,
        severityCounts: {
            critical: criticalCount,
            high: highCount,
            medium: mediumCount,
            low: lowCount
        },
        findings: formattedFindings
    };
}

/**
 * Filter out duplicate findings based on URL and type
 * @param {array} findings - Array of findings
 * @returns {array} - Deduplicated findings
 */
function deduplicateFindings(findings) {
    const seen = new Set();
    return findings.filter(finding => {
        const key = `${finding.type}_${finding.source}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

module.exports = {
    calculateSeverity,
    getSeverityLabel,
    formatAlert,
    saveAlert,
    generateReport,
    deduplicateFindings
};
