import assert from 'assert';
import http from 'http';

console.log('🧪 ========================================================');
console.log('🧪 Unit Tests: Direct Element Screenshot & Bot Card Bounding');
console.log('🧪 ========================================================\n');

// 1. Test Direct Element Bounding & Finding Logic
console.log('▶ Test Suite 1: DOM Hierarchy Card Container Resolution');

function resolveCardContainer(domTree) {
    const botKeywords = ['super bot fight mode', 'bot fight mode', 'bot management'];
    let targetElement = null;
    let detectedKeyword = '';

    for (const kw of botKeywords) {
        const found = domTree.find(el => (el.text || '').toLowerCase().includes(kw));
        if (found) {
            targetElement = found;
            detectedKeyword = kw;
            break;
        }
    }

    if (!targetElement) return null;

    // Simulate .closest('.setting-card, [class*="card"], section')
    let current = targetElement;
    let cardContainer = null;
    while (current) {
        if (current.className?.includes('setting-card') || current.className?.includes('card') || current.tag === 'section') {
            cardContainer = current;
            break;
        }
        current = current.parent;
    }

    return {
        card: cardContainer || targetElement,
        matchedMode: detectedKeyword,
        bounds: (cardContainer || targetElement).bounds
    };
}

// Test Case 1: Standard Cloudflare setting-card with Bot Fight Mode
const mockCard1 = { tag: 'div', className: 'setting-card c_gw c_ge', bounds: { top: 406, left: 639, width: 898, height: 459 } };
const mockInner1 = { tag: 'div', className: 'c_kf', parent: mockCard1, bounds: { top: 589, left: 672, width: 832, height: 196 } };
const mockHeading1 = { tag: 'span', text: 'Bot Fight Mode', parent: mockInner1, bounds: { top: 600, left: 672, width: 200, height: 24 } };

const res1 = resolveCardContainer([mockHeading1, mockInner1, mockCard1]);
assert.strictEqual(res1.matchedMode, 'bot fight mode');
assert.strictEqual(res1.card.className, 'setting-card c_gw c_ge');
assert.deepStrictEqual(res1.bounds, { top: 406, left: 639, width: 898, height: 459 });
console.log('  ✅ Passed Case 1: Successfully bound .setting-card container for Bot Fight Mode');

// Test Case 2: Enterprise Cloudflare card with Super Bot Fight Mode
const mockCard2 = { tag: 'section', className: 'card-body', bounds: { top: 320, left: 400, width: 950, height: 520 } };
const mockHeading2 = { tag: 'h2', text: 'Super Bot Fight Mode for Enterprise', parent: mockCard2, bounds: { top: 340, left: 420, width: 400, height: 32 } };

const res2 = resolveCardContainer([mockHeading2, mockCard2]);
assert.strictEqual(res2.matchedMode, 'super bot fight mode');
assert.strictEqual(res2.card.tag, 'section');
assert.deepStrictEqual(res2.bounds, { top: 320, left: 400, width: 950, height: 520 });
console.log('  ✅ Passed Case 2: Successfully bound section container for Super Bot Fight Mode');

// Test Case 3: Missing Bot Mode (Not present)
const res3 = resolveCardContainer([{ tag: 'h1', text: 'Overview Analytics' }, { tag: 'h2', text: 'DNS Records' }]);
assert.strictEqual(res3, null);
console.log('  ✅ Passed Case 3: Correctly identified missing Bot Mode');

// 2. Test Live Container API Endpoint for Bot Management
console.log('\n▶ Test Suite 2: Live API Endpoint Test (/api/ntbc-capture?type=bot-management)');

function testLiveApiEndpoint() {
    return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:8002/api/ntbc-capture?type=bot-management', (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`  API Response: HTTP ${res.statusCode}, success=${json.success}, isUnavailable=${json.isUnavailable}`);
                    assert.strictEqual(res.statusCode, 200, 'HTTP status should be 200');
                    assert.strictEqual(json.success, true, 'success should be true');
                    assert(json.image && json.image.startsWith('data:image/png;base64,'), 'Image should be valid base64 data URL');

                    // Decode base64 image and verify PNG magic bytes
                    const base64Data = json.image.replace(/^data:image\/png;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');
                    assert(buffer.length > 500, 'Image buffer should have content');
                    assert.strictEqual(buffer[0], 0x89, 'PNG magic byte 0 should be 0x89');
                    assert.strictEqual(buffer[1], 0x50, 'PNG magic byte 1 should be 0x50 (P)');
                    assert.strictEqual(buffer[2], 0x4E, 'PNG magic byte 2 should be 0x4E (N)');
                    assert.strictEqual(buffer[3], 0x47, 'PNG magic byte 3 should be 0x47 (G)');

                    console.log(`  ✅ Passed: Live API returned valid PNG (${buffer.length} bytes)`);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });
    });
}

(async () => {
    try {
        await testLiveApiEndpoint();
        console.log('\n========================================================');
        console.log('🎉 ALL UNIT TESTS PASSED (100% SUCCESS)');
        console.log('========================================================');
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
})();
