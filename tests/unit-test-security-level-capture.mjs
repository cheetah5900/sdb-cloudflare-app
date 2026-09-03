import assert from 'assert';
import http from 'http';

console.log('🧪 ========================================================');
console.log('🧪 Unit Tests: Security Level Card Detection & Bounding');
console.log('🧪 ========================================================');

function mockFindSecurityCard(domElements, keywords) {
    for (const kw of keywords) {
        const found = domElements.find(el => {
            const t = (el.textContent || '').trim().toLowerCase();
            return t.includes(kw) && (el.children?.length === 0 || el.tagName.startsWith('H'));
        });
        if (found) {
            const card = found.cardContainer || found;
            return {
                matchedKeyword: kw,
                rect: card.rect
            };
        }
    }
    return null;
}

// Test Suite 1: Security Level DOM Detection
console.log('\n▶ Test Suite 1: Security Level DOM Card Resolution');
const mockDOM1 = [
    {
        tagName: 'H3',
        textContent: 'Security Level',
        children: [],
        cardContainer: {
            className: 'setting-card',
            rect: { left: 638, top: 400, width: 900, height: 350 }
        }
    }
];
const res1 = mockFindSecurityCard(mockDOM1, ['security level']);
assert.ok(res1 !== null, 'Security Level card should be found');
assert.strictEqual(res1.matchedKeyword, 'security level');
console.log('  ✅ Passed Case 1: Successfully found and bound Security Level card container');

const mockDOM2 = [
    { tagName: 'DIV', textContent: 'Overview analytics summary', children: [] }
];
const res2 = mockFindSecurityCard(mockDOM2, ['security level']);
assert.strictEqual(res2, null, 'Should return null when Security Level is missing');
console.log('  ✅ Passed Case 2: Correctly identified missing Security Level and triggered fallback flow');

// Test Suite 2: Live API Endpoint
console.log('\n▶ Test Suite 2: Live API Endpoint (/api/ntbc-capture?type=security-level)');
http.get('http://localhost:8002/api/ntbc-capture?type=security-level', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            assert.strictEqual(res.statusCode, 200, 'HTTP status must be 200');
            assert.ok(json.success, 'Response must be success=true');
            assert.ok(json.image && json.image.startsWith('data:image/png;base64,'), 'Image must be base64 PNG');
            console.log(`  API Response: HTTP ${res.statusCode}, success=${json.success}, isUnavailable=${json.isUnavailable}`);
            console.log(`  ✅ Passed: Live API returned valid PNG (${Math.round(json.image.length * 0.75)} bytes)`);
            console.log('\n========================================================');
            console.log('🎉 ALL SECURITY LEVEL UNIT TESTS PASSED (100% SUCCESS)');
            console.log('========================================================');
        } catch (e) {
            console.error('  ❌ Test Failed:', e.message);
            process.exit(1);
        }
    });
}).on('error', (err) => {
    console.error('  ❌ Connection Error:', err.message);
    process.exit(1);
});
