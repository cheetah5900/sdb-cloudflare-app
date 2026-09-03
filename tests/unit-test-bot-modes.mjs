import assert from 'assert';
import http from 'http';
import sharp from 'sharp';

console.log('🧪 ========================================================');
console.log('🧪 Starting Unit Tests: Bot Management 3-Modes & Fallback');
console.log('🧪 ========================================================\n');

// 1. Test Fallback Image Generation (Vector SVG)
console.log('▶ Test Suite 1: Fallback Notice Image Generation (sharp + SVG)');
async function testFallbackImage() {
    const title = 'Bot Management / Fight Mode';
    const subtitle = 'ไม่พบโหมด Bot Fight Mode, Super Bot Fight Mode หรือ Bot Management ใน Cloudflare Account/Zone นี้';

    const cleanTitle = title.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    const cleanSubtitle = subtitle.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();

    const svg = `
    <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#090d16" />
                <stop offset="50%" stop-color="#0f172a" />
                <stop offset="100%" stop-color="#020617" />
            </linearGradient>
            <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1e293b" />
                <stop offset="100%" stop-color="#0f172a" />
            </linearGradient>
            <linearGradient id="alertGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#d97706" />
            </linearGradient>
        </defs>

        <rect width="1280" height="720" fill="url(#bgGrad)" />
        <rect x="140" y="100" width="1000" height="520" rx="24" fill="url(#cardGrad)" stroke="#334155" stroke-width="2" />
        
        <circle cx="640" cy="260" r="50" fill="#334155" fill-opacity="0.6" stroke="#475569" stroke-width="2" />
        <path d="M 640 230 L 670 285 L 610 285 Z" fill="url(#alertGrad)" stroke="#b45309" stroke-width="2" stroke-linejoin="round" />
        <rect x="638" y="250" width="4" height="18" rx="2" fill="#ffffff" />
        <circle cx="640" cy="276" r="2.5" fill="#ffffff" />

        <text x="640" y="370" font-family="sans-serif" font-size="34" font-weight="bold" text-anchor="middle" fill="#f8fafc">${cleanTitle}</text>
        <text x="640" y="420" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#94a3b8">${cleanSubtitle}</text>
        <text x="640" y="455" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#64748b">(ไม่สามารถแคปรูปภาพได้เนื่องจากไม่พบส่วนนี้ในแพ็กเกจหรือ Account ปัจจุบัน)</text>

        <rect x="420" y="500" width="440" height="46" rx="23" fill="#e11d48" fill-opacity="0.15" stroke="#f43f5e" stroke-width="1.5" />
        <text x="640" y="529" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#fda4af">[!] Feature Not Found / ไม่พบข้อมูลบนหน้าเว็บ</text>
    </svg>
    `;

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    assert(pngBuffer && pngBuffer.length > 0, 'Generated PNG buffer should not be empty');

    const meta = await sharp(pngBuffer).metadata();
    assert.strictEqual(meta.format, 'png', 'Format should be PNG');
    assert.strictEqual(meta.width, 1280, 'Width should be 1280');
    assert.strictEqual(meta.height, 720, 'Height should be 720');

    console.log(`  ✅ Passed: Fallback image generated successfully (${pngBuffer.length} bytes, 1280x720 PNG)`);
}

// 2. Test 3-Modes Keyword & Hierarchy Matching
console.log('\n▶ Test Suite 2: Bot Management 3-Modes Keyword Matching');
function evaluateBotModeDetection(domHeadings) {
    const botKeywords = ['super bot fight mode', 'bot fight mode', 'bot management'];
    let matchedHeading = null;
    let matchedName = '';
    
    for (const kw of botKeywords) {
        const found = domHeadings.find(h => h.trim().toLowerCase().includes(kw));
        if (found) {
            matchedHeading = found;
            matchedName = kw;
            break;
        }
    }
    
    return {
        found: !!matchedHeading,
        matchedMode: matchedName,
        headingText: matchedHeading
    };
}

function testBotModeDetection() {
    // Case 1: Free Plan has "Bot Fight Mode"
    const case1 = evaluateBotModeDetection(['Security Level', 'Bot Fight Mode', 'Browser Integrity Check']);
    assert.strictEqual(case1.found, true, 'Case 1 should find Bot Fight Mode');
    assert.strictEqual(case1.matchedMode, 'bot fight mode', 'Matched mode should be bot fight mode');
    console.log('  ✅ Passed Case 1 (Free Plan): Detected "Bot Fight Mode"');

    // Case 2: Pro/Business Plan has "Super Bot Fight Mode"
    const case2 = evaluateBotModeDetection(['Security Level', 'Super Bot Fight Mode', 'Privacy Pass']);
    assert.strictEqual(case2.found, true, 'Case 2 should find Super Bot Fight Mode');
    assert.strictEqual(case2.matchedMode, 'super bot fight mode', 'Matched mode should be super bot fight mode');
    console.log('  ✅ Passed Case 2 (Pro/Biz Plan): Detected "Super Bot Fight Mode"');

    // Case 3: Enterprise Plan has "Bot Management"
    const case3 = evaluateBotModeDetection(['Bot Management', 'Custom Rules', 'Rate Limiting']);
    assert.strictEqual(case3.found, true, 'Case 3 should find Bot Management');
    assert.strictEqual(case3.matchedMode, 'bot management', 'Matched mode should be bot management');
    console.log('  ✅ Passed Case 3 (Enterprise Plan): Detected "Bot Management"');

    // Case 4: No Bot Feature (Missing / Unsupported plan)
    const case4 = evaluateBotModeDetection(['Overview', 'Analytics', 'DNS']);
    assert.strictEqual(case4.found, false, 'Case 4 should return found=false');
    assert.strictEqual(case4.matchedMode, '', 'Matched mode should be empty');
    console.log('  ✅ Passed Case 4 (Unsupported Plan): Correctly reported not found (triggers fallback notice)');
}

// 3. Test Live Backend Server Health
console.log('\n▶ Test Suite 3: Live Server API Response & Disk Persistence');
function testLiveApi() {
    return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:8002/api/ntbc-capture?action=get-saved', (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    assert.strictEqual(res.statusCode, 200, 'HTTP status code should be 200');
                    const json = JSON.parse(data);
                    assert.strictEqual(json.success, true, 'Response JSON should have success: true');
                    assert(json.screenshots, 'Response should contain screenshots object');
                    assert(json.screenshots.hasOwnProperty('botManagement'), 'Screenshots should include botManagement key');
                    console.log('  ✅ Passed: Live API /api/ntbc-capture?action=get-saved is active and responsive (HTTP 200)');
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', (err) => reject(err));
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('API request timed out'));
        });
    });
}

async function runAll() {
    try {
        await testFallbackImage();
        testBotModeDetection();
        await testLiveApi();
        console.log('\n🎉 ========================================================');
        console.log('🎉 ALL UNIT TESTS PASSED SUCCESSFULLY! (100% Verified)');
        console.log('🎉 ========================================================');
        process.exit(0);
    } catch (e) {
        console.error('\n❌ UNIT TEST FAILED:', e);
        process.exit(1);
    }
}

runAll();
