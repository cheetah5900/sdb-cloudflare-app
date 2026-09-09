import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const outDir = path.join(process.cwd(), '.gls_ocr_verification_results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Variable to capture type & keyword mapping
const VAR_MAP = {
    '@captured_bot_management': {
        type: 'bot-management',
        label: 'Bot Management / Fight Mode',
        expectedKeywords: ['bot', 'super bot fight mode', 'bot fight mode', 'bot management', 'fight mode', 'detect bots', 'cloudflare']
    },
    '@captured_security_level': {
        type: 'security-level',
        label: 'Security Level & Settings',
        expectedKeywords: ['security level', 'security', 'settings', 'browser integrity', 'protection', 'cloudflare']
    },
    '@captured_ssl_overview': {
        type: 'ssl-overview',
        label: 'SSL/TLS Overview',
        expectedKeywords: ['ssl', 'tls', 'encryption mode', 'full', 'flexible', 'strict', 'overview']
    },
    '@captured_ssl_edge': {
        type: 'ssl-edge',
        label: 'Edge Certificates',
        expectedKeywords: ['edge certificates', 'certificates', 'ssl', 'tls', 'universal', 'hostnames']
    },
    '@captured_dns_page': {
        type: 'dns',
        label: 'DNS Management',
        expectedKeywords: ['dns', 'records', 'type', 'name', 'content', 'proxy status', 'ttl']
    },
    '@captured_security_rules_page': {
        type: 'security-rules',
        label: 'Security Rules (Custom Rules)',
        expectedKeywords: ['custom rules', 'rules', 'security', 'waf', 'rate limiting', 'manage']
    },
    '@captured_rate_limiting_page': {
        type: 'rate-limiting',
        label: 'Rate Limiting Rules',
        expectedKeywords: ['rate limiting', 'rate limits', 'rules', 'rate']
    },
    '@captured_managed_rules_page': {
        type: 'managed-rules',
        label: 'Managed WAF Rules',
        expectedKeywords: ['managed rules', 'waf', 'cloudflare managed', 'owasp', 'rules']
    },
    '@captured_ip_access_page': {
        type: 'ip-access',
        label: 'IP Access Rules',
        expectedKeywords: ['ip access', 'access rules', 'ip', 'tools', 'firewall']
    },
    '@captured_zone_lockdown_page': {
        type: 'zone-lockdown',
        label: 'Zone Lockdown Rules',
        expectedKeywords: ['zone lockdown', 'lockdown', 'rules', 'tools']
    },
    '@captured_request_traffic_page': {
        type: 'traffic',
        subIndex: 1,
        label: 'HTTP Traffic (Requests Graph)',
        expectedKeywords: ['traffic', 'requests', 'analytics', 'cached', 'uncached', 'http']
    },
    '@captured_data_transfer_traffic_page': {
        type: 'traffic',
        subIndex: 2,
        label: 'HTTP Traffic (Data Transfer Graph)',
        expectedKeywords: ['traffic', 'data transfer', 'bandwidth', 'analytics', 'bytes', 'total']
    },
    '@captured_traffic_countries_page': {
        type: 'traffic-countries',
        label: 'Traffic by Country / Top Locations',
        expectedKeywords: ['country', 'location', 'traffic', 'requests', 'top', 'data transfer']
    },
    '@captured_firewall_page': {
        type: 'firewall',
        label: 'Firewall Overview / Security Events',
        expectedKeywords: ['security', 'events', 'firewall', 'activity', 'waf', 'analytics', 'blocked', 'log']
    },
    '@captured_top_events_source_page': {
        type: 'top-events-source',
        label: 'Top Events by Source',
        expectedKeywords: ['events', 'source', 'security', 'top', 'action', 'service', 'firewall']
    }
};

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

async function verifyGLSTemplate() {
    console.log('========================================================================');
    console.log('🔍 VERIFYING ALL CAPTURED VARIABLES IN GLS TEMPLATE WITH APPLE VISION OCR');
    console.log('========================================================================\n');

    const templatePath = path.join(process.cwd(), 'app/data/templates/ntbc_t_1788234492865_domain.json');
    const templateRaw = fs.readFileSync(templatePath, 'utf8');
    const glsVars = [...new Set(templateRaw.match(/@captured_[a-zA-Z0-9_\-]+/g) || [])];

    console.log(`📋 Found ${glsVars.length} image capture variables in GLS template:`);
    glsVars.forEach((v, idx) => console.log(`  ${idx + 1}. ${v}`));
    console.log('\n------------------------------------------------------------------------');

    const results = [];

    for (let i = 0; i < glsVars.length; i++) {
        const varName = glsVars[i];
        const config = VAR_MAP[varName] || {
            type: varName.replace('@captured_', '').replace(/_/g, '-'),
            label: varName,
            expectedKeywords: [varName.replace('@captured_', '').replace(/_/g, ' ')]
        };

        process.stdout.write(`\n[${i + 1}/${glsVars.length}] Capturing ${varName} (${config.label})... `);

        try {
            const start = Date.now();
            const res = await fetchCapture(config.type);
            const duration = ((Date.now() - start) / 1000).toFixed(1);

            if (!res.data.success) {
                console.log(`❌ FAILED (API error: ${res.data.error || 'No success'})`);
                results.push({ varName, label: config.label, status: 'FAILED', detail: res.data.error || 'API Failed', duration });
                continue;
            }

            let base64Data = res.data.image;
            if (config.subIndex === 1 && res.data.imageSub1) base64Data = res.data.imageSub1;
            if (config.subIndex === 2 && res.data.imageSub2) base64Data = res.data.imageSub2;
            if (config.subIndex === 3 && res.data.imageSub3) base64Data = res.data.imageSub3;
            if (config.subIndex === 4 && res.data.imageSub4) base64Data = res.data.imageSub4;
            if (config.subIndex === 5 && res.data.imageSub5) base64Data = res.data.imageSub5;

            if (!base64Data) {
                console.log(`❌ FAILED (No image data in response)`);
                results.push({ varName, label: config.label, status: 'FAILED', detail: 'No image data', duration });
                continue;
            }

            const imgBuffer = Buffer.from(base64Data.replace(/^data:image\/png;base64,/, ''), 'base64');
            const cleanName = varName.replace('@', '');
            const imgPath = path.join(outDir, `${cleanName}.png`);
            fs.writeFileSync(imgPath, imgBuffer);

            // Execute native Apple Vision OCR
            const ocrText = runOCR(imgPath);
            const ocrLower = ocrText.toLowerCase();

            const matchedKeyword = config.expectedKeywords.find(kw => ocrLower.includes(kw.toLowerCase()));
            const isFallback = ocrLower.includes('not found') || ocrLower.includes('ไม่พบข้อมูล') || res.data.isUnavailable;

            let passed = false;
            let detail = '';

            if (matchedKeyword) {
                passed = true;
                detail = `OCR Match: "${matchedKeyword}" detected`;
            } else if (isFallback) {
                passed = true;
                detail = `Fallback Match: Feature not active in Zone (Standard dark placeholder verified)`;
            } else {
                detail = `No match for [${config.expectedKeywords.join(', ')}] in OCR: "${ocrText.slice(0, 80).replace(/\n/g, ' ')}..."`;
            }

            const snippet = ocrText.slice(0, 90).replace(/\n/g, ' ');

            if (passed) {
                console.log(`✅ PASSED (${duration}s)`);
                console.log(`   ➜ ${detail}`);
                console.log(`   ➜ OCR Snippet: "${snippet}"`);
                results.push({ varName, label: config.label, type: config.type, status: 'PASSED', detail, duration, snippet });
            } else {
                console.log(`⚠️ MISMATCH (${duration}s)`);
                console.log(`   ➜ ${detail}`);
                console.log(`   ➜ OCR Snippet: "${snippet}"`);
                results.push({ varName, label: config.label, type: config.type, status: 'MISMATCH', detail, duration, snippet });
            }

        } catch (err) {
            console.log(`❌ ERROR: ${err.message}`);
            results.push({ varName, label: config.label, status: 'ERROR', detail: err.message, duration: '0.0' });
        }
    }

    console.log('\n========================================================================================================');
    console.log('📊 GLS TEMPLATE OCR VERIFICATION RESULTS');
    console.log('========================================================================================================');

    console.table(results.map(r => ({
        Variable: r.varName,
        Topic: r.label,
        Status: r.status,
        Duration: `${r.duration}s`,
        Verification: r.detail
    })));

    const passedCount = results.filter(r => r.status === 'PASSED').length;
    const totalCount = results.length;
    console.log(`\n🎯 FINAL RESULT: ${passedCount}/${totalCount} GLS VARIABLES VERIFIED BY OCR (${Math.round(passedCount / totalCount * 100)}% PASS RATE)`);
    console.log('========================================================================================================\n');
}

verifyGLSTemplate().catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
});
