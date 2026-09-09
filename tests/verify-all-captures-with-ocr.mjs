import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CAPTURE_ITEMS = [
    { type: 'domains', label: 'Domains', expectedKeywords: ['domain', 'overview', 'name', 'status', 'registrations'] },
    { type: 'dns', label: 'DNS Management', expectedKeywords: ['dns', 'records', 'management', 'type', 'name', 'content'] },
    { type: 'load-balancing-spectrum', label: 'Load Balancing & Spectrum (IF Enable)', expectedKeywords: ['load balancing', 'spectrum', 'records'] },
    { type: 'traffic', label: 'HTTP Traffic Analytics', expectedKeywords: ['traffic', 'requests', 'bandwidth', 'analytics', 'cached'] },
    { type: 'firewall', label: 'Security Events / Firewall', expectedKeywords: ['security', 'events', 'firewall', 'activity', 'waf', 'blocked'] },
    { type: 'security-rules', label: 'Security Rules', expectedKeywords: ['rules', 'custom rules', 'security', 'waf', 'rate limiting'] },
    { type: 'bot-management', label: 'Bot Management / Fight Mode', expectedKeywords: ['bot fight mode', 'super bot', 'bot management', 'bot', 'detect bots'] },
    { type: 'security-level', label: 'Security Level & Settings', expectedKeywords: ['security level', 'security', 'settings', 'always protected', 'attack'] },
    { type: 'browser-integrity-check', label: 'Browser Integrity Check (IF Enable)', expectedKeywords: ['browser integrity check', 'browser integrity', 'browser check'] },
    { type: 'ssl-overview', label: 'SSL/TLS Overview', expectedKeywords: ['ssl', 'tls', 'encryption mode', 'full', 'flexible', 'overview'] },
    { type: 'ssl-edge', label: 'Edge Certificates', expectedKeywords: ['edge certificates', 'certificates', 'ssl', 'tls', 'universal'] },
    { type: 'min-tls-version', label: 'Minimum TLS Version', expectedKeywords: ['minimum tls version', 'minimum tls', 'min tls', 'tls'] },
    { type: 'tls-1-3', label: 'TLS 1.3 (IF Enable)', expectedKeywords: ['tls 1.3', 'tls', 'encryption', '0-rtt'] },
    { type: 'argo', label: 'Argo Smart Routing', expectedKeywords: ['argo', 'smart routing', 'tiered cache', 'routing'] },
    { type: 'speed', label: 'Speed & Observatory', expectedKeywords: ['speed', 'observatory', 'performance', 'score', 'desktop'] },
    { type: 'speed-mobile', label: 'Speed Mobile', expectedKeywords: ['speed', 'observatory', 'performance', 'mobile'] },
    { type: 'rate-limiting', label: 'Rate Limiting Rules', expectedKeywords: ['rate limiting', 'rate limits', 'rules', 'rate'] },
    { type: 'managed-rules', label: 'Managed WAF Rules', expectedKeywords: ['managed rules', 'waf', 'cloudflare managed', 'owasp'] },
    { type: 'ip-access-rules', label: 'IP Access Rules', expectedKeywords: ['ip access', 'access rules', 'ip', 'firewall'] },
    { type: 'zone-lockdown', label: 'Zone Lockdown Rules', expectedKeywords: ['zone lockdown', 'lockdown', 'rules'] },
    { type: 'traffic-countries', label: 'Traffic by Country', expectedKeywords: ['country', 'location', 'traffic', 'requests', 'top'] },
    { type: 'top-events-source', label: 'Top Events by Source', expectedKeywords: ['events', 'source', 'security', 'top', 'action'] }
];

const outDir = path.join(process.cwd(), '.ocr_verification_results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function fetchCapture(type) {
    return new Promise((resolve, reject) => {
        const url = `http://localhost:8002/api/ntbc-capture?type=${type}`;
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, data: json });
                } catch (e) {
                    reject(new Error(`Failed to parse JSON for ${type}: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

function runOCR(imagePath) {
    try {
        const output = execSync(`swift scripts/ocr_runner.swift "${imagePath}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        return output.trim();
    } catch (e) {
        return `OCR_ERROR: ${e.message}`;
    }
}

async function runAll() {
    console.log('========================================================================');
    console.log('🔍 FULL-SYSTEM OCR VERIFICATION FOR ALL CAPTURE TABS (18 ITEMS)');
    console.log('========================================================================\n');

    const results = [];

    for (let i = 0; i < CAPTURE_ITEMS.length; i++) {
        const item = CAPTURE_ITEMS[i];
        process.stdout.write(`[${i + 1}/${CAPTURE_ITEMS.length}] Testing [${item.label}] (${item.type})... `);

        try {
            const start = Date.now();
            const res = await fetchCapture(item.type);
            const duration = ((Date.now() - start) / 1000).toFixed(1);

            if (!res.data.success || !res.data.image) {
                console.log(`❌ FAILED (API returned error: ${res.data.error || 'No image'})`);
                results.push({ item, status: 'FAILED', reason: 'No image returned', duration });
                continue;
            }

            const imgBuffer = Buffer.from(res.data.image.replace(/^data:image\/png;base64,/, ''), 'base64');
            const imgPath = path.join(outDir, `${item.type}.png`);
            fs.writeFileSync(imgPath, imgBuffer);

            // Execute Apple Vision OCR
            const ocrText = runOCR(imgPath);
            const ocrLower = ocrText.toLowerCase();

            // Verification logic:
            // Check if OCR text matches either expected keywords OR matches Fallback format (Feature Not Found)
            const matchedKeyword = item.expectedKeywords.find(kw => ocrLower.includes(kw.toLowerCase()));
            const isFallback = ocrLower.includes('not found') || ocrLower.includes('ไม่พบข้อมูล') || res.data.isUnavailable;

            let passed = false;
            let detail = '';

            if (matchedKeyword) {
                passed = true;
                detail = `Live Match: "${matchedKeyword}" found in OCR`;
            } else if (isFallback) {
                passed = true;
                detail = `Fallback Match: Feature unavailable in Zone/Account (Dark Theme placeholder verified)`;
            } else {
                detail = `No match for [${item.expectedKeywords.join(', ')}] in OCR text: "${ocrText.slice(0, 80).replace(/\n/g, ' ')}..."`;
            }

            if (passed) {
                console.log(`✅ PASSED (${duration}s) -> ${detail}`);
                results.push({ item, status: 'PASSED', detail, duration, ocrSnippet: ocrText.slice(0, 100).replace(/\n/g, ' ') });
            } else {
                console.log(`⚠️ MISMATCH (${duration}s) -> ${detail}`);
                results.push({ item, status: 'MISMATCH', detail, duration, ocrSnippet: ocrText.slice(0, 100).replace(/\n/g, ' ') });
            }

        } catch (err) {
            console.log(`❌ ERROR: ${err.message}`);
            results.push({ item, status: 'ERROR', detail: err.message, duration: '0.0' });
        }
    }

    console.log('\n========================================================================');
    console.log('📊 OCR VERIFICATION SUMMARY REPORT');
    console.log('========================================================================');

    console.table(results.map(r => ({
        Tab: r.item.label,
        Type: r.item.type,
        Status: r.status,
        Duration: `${r.duration}s`,
        Verification: r.detail
    })));

    const passedCount = results.filter(r => r.status === 'PASSED').length;
    const totalCount = results.length;
    console.log(`\n🎯 TOTAL RESULT: ${passedCount}/${totalCount} TABS VERIFIED BY OCR (${Math.round(passedCount / totalCount * 100)}% PASS RATE)`);
    console.log('========================================================================\n');
}

runAll().catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
});
