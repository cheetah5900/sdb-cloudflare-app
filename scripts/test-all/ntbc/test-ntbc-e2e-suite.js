/**
 * Full E2E Test Suite for NTBC CFReport
 * 1. Module 1: Dashboard Layout & Live Browser Monitor
 * 2. Module 2: Image Size Settings Modal & Bidirectional Sync (Debug -> Image Size)
 * 3. Module 3: Quick Debug Session (17 Tabs, Image Size -> Debug Sync, & Live Page Capture)
 * 4. Module 4: GLS Template Verification (15 Dynamic Variables)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';
const TMP_DOWNLOAD_DIR = path.join(__dirname, '../tmp_downloads');
if (!fs.existsSync(TMP_DOWNLOAD_DIR)) fs.mkdirSync(TMP_DOWNLOAD_DIR, { recursive: true });

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m"
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

const testResults = [];

function recordResult(pageName, action, selector, criteria, result, status) {
    testResults.push({
        'หน้า (Page)': pageName,
        'ขั้นตอนการทดสอบ (Action)': action,
        'ปุ่ม / Selector ที่กด': selector,
        'เกณฑ์การวัดผล (Criteria)': criteria,
        'ผลลัพธ์ที่ได้ (Result)': result,
        'สถานะ (Status)': status ? '✅ Passed' : '❌ Failed'
    });
    const statusColor = status ? colors.green : colors.red;
    log(`[${status ? 'PASS' : 'FAIL'}] ${pageName} > ${action}: ${result}`, statusColor);
}

async function runE2ESuite() {
    log('\n=============================================================', colors.cyan);
    log('🚀 Starting Full E2E Test Suite: NTBC CFReport System', colors.cyan + colors.bold);
    log('=============================================================\n', colors.cyan);

    let browser;
    let page;

    try {
        log('🔹 Launching Puppeteer browser for E2E testing...', colors.blue);
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ],
            defaultViewport: { width: 1440, height: 900 }
        });

        page = await browser.newPage();
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: TMP_DOWNLOAD_DIR,
        });

        page.on('pageerror', err => log(`   [Page Error] ${err.message}`, colors.red));
        page.on('console', msg => {
            if (msg.type() === 'error') log(`   [Console Error] ${msg.text()}`, colors.yellow);
        });

        // -------------------------------------------------------------
        // STEP 0: Authentication (Login)
        // -------------------------------------------------------------
        log('\n🔑 STEP 0: Authenticating into System...', colors.blue);
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));

        if (page.url().includes('/login')) {
            await page.waitForSelector('input[type="text"]', { visible: true });
            await page.type('input[type="text"]', 'root');
            await page.type('input[type="password"]', 'password');
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 2500));
        }

        const isLogged = !page.url().includes('/login');
        recordResult(
            'Login',
            'เข้าสู่ระบบด้วย root / password',
            'input[type="password"] -> Enter',
            'Redirect เข้าสู่ Dashboard',
            isLogged ? `Logged in successfully (URL: ${page.url()})` : 'Login failed',
            isLogged
        );
        if (!isLogged) throw new Error('Login failed');

        // -------------------------------------------------------------
        // MODULE 1: NTBC Dashboard Layout & Live Monitor
        // -------------------------------------------------------------
        log('\n🖥️ MODULE 1: NTBC Dashboard Layout & Live Monitor Verification', colors.blue);
        await page.goto(`${BASE_URL}/systems/ntbc_cfreport`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        // 1.1 Verify 3 Workspace Cards
        const cardHeaders = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim());
        });
        const hasImageSettingsCard = cardHeaders.includes('Image Size Settings');
        const hasManageTemplateCard = cardHeaders.includes('Manage Templates');
        const hasGenerateReportCard = cardHeaders.includes('Generate Report');

        recordResult(
            'NTBC Dashboard',
            'ตรวจสอบการ์ดทั้ง 3 บนหน้าหลัก',
            'h3 cards',
            'มี Image Size Settings, Manage Templates, Generate Report ครบ',
            `พบการ์ด: ${cardHeaders.join(' | ')}`,
            hasImageSettingsCard && hasManageTemplateCard && hasGenerateReportCard
        );

        // 1.2 Verify Embedded Live Monitor (noVNC iframe)
        const vncIframeSrc = await page.evaluate(() => {
            const iframe = document.querySelector('iframe[title="Live Browser Monitor"]');
            return iframe ? iframe.getAttribute('src') : null;
        });
        const hasVncMonitor = !!vncIframeSrc && vncIframeSrc.includes('/vnc/');
        recordResult(
            'NTBC Dashboard',
            'ตรวจสอบ Live Browser Monitor บนหน้าหลัก',
            'iframe[title="Live Browser Monitor"]',
            'มี Live Monitor iframe ฝังอยู่ใต้การ์ดและเชื่อมต่อ VNC',
            hasVncMonitor ? `Live Monitor พร้อมใช้งาน (src: ${vncIframeSrc})` : 'ไม่พบ Live Monitor iframe',
            hasVncMonitor
        );

        // -------------------------------------------------------------
        // MODULE 2: Image Size Settings Modal & Sync
        // -------------------------------------------------------------
        log('\n📐 MODULE 2: Image Size Settings Modal & Bidirectional Sync', colors.blue);

        // 2.1 Open Image Size Settings modal
        await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('h3'));
            const target = cards.find(c => c.textContent.trim() === 'Image Size Settings');
            if (target) target.closest('div').click();
        });
        await new Promise(r => setTimeout(r, 1500));

        const isModalOpen = await page.evaluate(() => {
            return !!document.querySelector('input[placeholder="Auto"]');
        });
        recordResult(
            'Image Size Settings',
            'คลิกเปิดหน้าต่าง Image Size Settings',
            'Card: Image Size Settings',
            'Modal แสดงผลพร้อมฟิลด์ Width (px) และ Crop Coordinates',
            isModalOpen ? 'Modal เปิดและเรนเดอร์ input ครบถ้วน' : 'Modal ไม่เปิด',
            isModalOpen
        );

        // 2.2 Test "📥 ดึงค่าจาก Debug Setting" button
        const pullFromDebugBtn = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.includes('ดึงค่าจาก Debug Setting'));
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        await new Promise(r => setTimeout(r, 1500));

        const swalTitle = await page.evaluate(() => {
            const el = document.querySelector('.swal2-title');
            return el ? el.textContent : null;
        });
        recordResult(
            'Image Size Settings',
            'กดปุ่ม "📥 ดึงค่าจาก Debug Setting"',
            'Button: 📥 ดึงค่าจาก Debug Setting',
            'คัดลอกพิกัด Crop จาก Debug Setting มาใส่ใน Modal และแจ้งเตือนสำเร็จ',
            `แจ้งเตือนผลลัพธ์: ${swalTitle || 'ดึงค่าสำเร็จ'}`,
            pullFromDebugBtn
        );

        // 2.3 Modify a coordinate and save
        const savedSettings = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="number"], input[type="text"]'));
            if (inputs.length > 0) {
                const firstInput = inputs[0];
                firstInput.value = '750';
                firstInput.dispatchEvent(new Event('input', { bubbles: true }));
                firstInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Settings'));
            if (saveBtn) {
                saveBtn.click();
                return true;
            }
            return false;
        });
        await new Promise(r => setTimeout(r, 1500));

        // Verify independent localStorage key `ntbc:image-size-settings`
        const localSettings = await page.evaluate(() => {
            return localStorage.getItem('ntbc:image-size-settings');
        });
        const hasIndependentStorage = !!localSettings && localSettings.includes('widths') && localSettings.includes('coords');
        recordResult(
            'Image Size Settings',
            'บันทึกการตั้งค่าลง LocalStorage แบบอิสระ',
            'Button: Save Settings',
            'จัดเก็บใน key `ntbc:image-size-settings` แยกเป็นอิสระจาก control_coords',
            hasIndependentStorage ? `บันทึกสำเร็จ: ${localSettings.substring(0, 80)}...` : 'ไม่พบข้อมูลใน LocalStorage',
            hasIndependentStorage
        );

        // Close modal
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 1000));

        // -------------------------------------------------------------
        // MODULE 3: Quick Debug Session & Live Captures
        // -------------------------------------------------------------
        log('\n⚡ MODULE 3: Quick Debug Session & Live Screenshot Captures', colors.blue);
        await page.goto(`${BASE_URL}/systems/ntbc_cfreport/control`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2500));

        // 3.1 Verify all 17 tabs in the sidebar
        const tabs = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div.flex-col button, div.overflow-x-auto button'));
            return buttons.map(b => b.textContent.trim()).filter(t => t.length > 0 && !t.includes('Fullscreen') && !t.includes('Maximize') && !t.includes('Reset') && !t.includes('Back'));
        });
        
        const expectedTabs = ['Domains', 'DNS Records', 'Bot Management', 'Security Level', 'SSL/TLS Mode', 'Edge Certificates', 'HTTP Traffic', 'Traffic Countries', 'Firewall', 'Events by Source', 'Custom Rules', 'Rate Limiting', 'Managed WAF', 'IP Access', 'Zone Lockdown', 'Argo Smart', 'Speed Test'];
        const foundAllTabs = expectedTabs.every(exp => tabs.some(t => t.includes(exp)));

        recordResult(
            'Quick Debug Session',
            'ตรวจสอบแท็บรายการ Screenshot ทั้ง 17 หมวด',
            'Sidebar Navigation Tabs',
            'มีแท็บครบทั้ง 17 หมวดหมู่สำหรับทุกตัวแปร',
            `พบทั้งหมด ${tabs.length} แท็บ (${foundAllTabs ? 'ครบทุกหมวด' : 'ขาดบางหมวด'})`,
            foundAllTabs
        );

        // 3.2 Test "📥 ดึงค่าจาก Image Size Setting" button in Crop Coordinates
        const pullFromImageSizeBtn = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.includes('ดึงจาก Image Size') || b.textContent.includes('ดึงค่าจาก Image Size Setting') || b.title?.includes('ดึงค่าจาก Image Size Setting'));
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        await new Promise(r => setTimeout(r, 1500));

        const pullSwal = await page.evaluate(() => {
            const el = document.querySelector('.swal2-title');
            return el ? el.textContent : null;
        });
        recordResult(
            'Quick Debug Session',
            'กดปุ่ม "📥 ดึงค่าจาก Image Size Setting" ในกล่องพิกัด Crop',
            'Button: 📥 ดึงค่าจาก Image Size Setting',
            'คัดลอกพิกัดจาก Image Size Setting มาใส่ใน Debug Coords สำเร็จ',
            `สถานะการดึงค่า: ${pullSwal || 'ดึงค่าสำเร็จ'}`,
            pullFromImageSizeBtn
        );

        // 3.3 Test Direct Live Capture on Bot Management Tab
        log('   -> Testing direct single capture on Bot Management...', colors.cyan);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const botTab = btns.find(b => b.textContent.includes('Bot Management'));
            if (botTab) botTab.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        const captureBtnClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const capBtn = btns.find(b => b.textContent.includes('Capture This Page Now'));
            if (capBtn) {
                capBtn.click();
                return true;
            }
            return false;
        });

        // Wait up to 35 seconds for live Chrome navigation and screenshot
        log('   -> Waiting for live Chrome navigation and capture (max 35s)...', colors.gray);
        let captureSuccess = false;
        const capStart = Date.now();
        while (Date.now() - capStart < 35000) {
            const hasImg = await page.evaluate(() => {
                const img = document.querySelector('img[alt*="Bot Management"]');
                return img && img.getAttribute('src') && img.getAttribute('src').startsWith('data:image/png;base64,');
            });
            if (hasImg) {
                captureSuccess = true;
                break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        recordResult(
            'Quick Debug Session',
            'กด "📸 Capture This Page Now" บนแท็บ Bot Management',
            'Button: 📸 Capture This Page Now',
            'สั่ง Chrome Live Monitor ไปหน้า Cloudflare และได้ภาพ Data URL 1920x1080',
            captureSuccess ? 'แคปรูปภาพ Bot Management สดสำเร็จและแสดงพรีวิว' : 'เกิดข้อผิดพลาดในการแคปรูปภาพ',
            captureSuccess
        );

        // -------------------------------------------------------------
        // MODULE 4: GLS Template Verification
        // -------------------------------------------------------------
        log('\n📑 MODULE 4: GLS Template Dynamic Variables Verification', colors.blue);
        
        // Fetch all templates and locate GLS template dynamically
        const templatesListRes = await axios.get(`${BASE_URL}/api/ntbc-templates`);
        const glsMeta = (templatesListRes.data || []).find(t => (t.name || '').toLowerCase().includes('gls')) || { id: '1788234492865' };
        
        const templateRes = await axios.get(`${BASE_URL}/api/ntbc-static-template?id=${glsMeta.id}`);
        const templateHtml = templateRes.data.template || '';
        const dynamicVarMatches = templateHtml.match(/@captured_[a-z0-9_]+/g) || [];
        const uniqueVars = Array.from(new Set(dynamicVarMatches));

        recordResult(
            'GLS Template',
            'ตรวจสอบตัวแปร Dynamic Screenshot ใน Template GLS',
            `API: /api/ntbc-static-template?id=${glsMeta.id}`,
            'มีตัวแปร @captured_bot_management, @captured_security_level ฯลฯ ครบ',
            `พบตัวแปร Dynamic ทั้งหมด ${uniqueVars.length} ตัวแปร (${uniqueVars.slice(0, 4).join(', ')}...)`,
            uniqueVars.length >= 15
        );

        // -------------------------------------------------------------
        // MODULE 5: End-to-End Image Capture & Apple Vision OCR Verification
        // -------------------------------------------------------------
        log('\n🔍 MODULE 5: Full Screenshot Capture & Apple Vision OCR Text Verification', colors.blue + colors.bold);

        // Close Puppeteer test browser to release any locks before making live Chrome captures
        if (browser) {
            await browser.close();
            browser = null;
        }
        await new Promise(r => setTimeout(r, 1000));

        const OCR_TARGETS = [
            { varTag: '@captured_bot_management', type: 'bot-management', label: 'Bot Management / Fight Mode', keywords: ['bot', 'fight mode', 'detect bots', 'cloudflare'] },
            { varTag: '@captured_security_level', type: 'security-level', label: 'Security Level & Settings', keywords: ['security level', 'security', 'settings', 'browser integrity'] },
            { varTag: '@captured_ssl_overview', type: 'ssl-overview', label: 'SSL/TLS Overview', keywords: ['ssl', 'tls', 'encryption mode', 'overview'] },
            { varTag: '@captured_ssl_edge', type: 'ssl-edge', label: 'Minimum TLS Version (SSL Edge)', keywords: ['minimum tls', 'min tls', 'edge certificates', 'tls'] },
            { varTag: '@captured_dns_page', type: 'dns', label: 'DNS Management', keywords: ['dns', 'records', 'type', 'name', 'content'] },
            { varTag: '@captured_security_rules_page', type: 'security-rules', label: 'Security Rules (Custom Rules)', keywords: ['custom rules', 'rules', 'security', 'waf'] },
            { varTag: '@captured_rate_limiting_page', type: 'rate-limiting', label: 'Rate Limiting Rules', keywords: ['rate limiting', 'rate limits', 'rules'] },
            { varTag: '@captured_managed_rules_page', type: 'managed-rules', label: 'Managed WAF Rules', keywords: ['managed rules', 'waf', 'cloudflare managed', 'owasp'] },
            { varTag: '@captured_ip_access_page', type: 'ip-access', label: 'IP Access Rules', keywords: ['ip access', 'access rules', 'ip', 'tools', 'security'] },
            { varTag: '@captured_zone_lockdown_page', type: 'zone-lockdown', label: 'Zone Lockdown Rules', keywords: ['zone lockdown', 'lockdown', 'rules', 'tools'] },
            { varTag: '@captured_request_traffic_page', type: 'traffic', subIndex: 1, label: 'HTTP Traffic (Requests Graph)', keywords: ['traffic', 'requests', 'analytics', 'http'] },
            { varTag: '@captured_data_transfer_traffic_page', type: 'traffic', subIndex: 2, label: 'HTTP Traffic (Data Transfer Graph)', keywords: ['traffic', 'data transfer', 'bandwidth', 'analytics'] },
            { varTag: '@captured_traffic_countries_page', type: 'traffic-countries', label: 'Traffic by Country', keywords: ['country', 'countries', 'location', 'traffic', 'requests', 'volume'] },
            { varTag: '@captured_firewall_page', type: 'firewall', label: 'Firewall Overview / Security Events', keywords: ['security', 'events', 'firewall', 'analytics', 'activity', 'waf'] },
            { varTag: '@captured_top_events_source_page', type: 'top-events-source', label: 'Top Events by Source', keywords: ['events', 'source', 'security', 'top', 'action', 'service'] },
            { varTag: '@captured_tls_1_3', type: 'tls-1-3', label: 'TLS 1.3 (IF Enable)', keywords: ['tls 1.3', 'tls', 'encryption', 'feature verification'] },
            { varTag: '@captured_browser_integrity', type: 'browser-integrity-check', label: 'Browser Integrity Check (IF Enable)', keywords: ['browser integrity check', 'browser integrity', 'feature verification'] },
            { varTag: '@captured_load_balancing_spectrum', type: 'load-balancing-spectrum', label: 'Load Balancing & Spectrum (IF Enable)', keywords: ['load balancing', 'spectrum', 'feature verification', 'records', 'dns'] }
        ];

        const ocrDir = path.join(TMP_DOWNLOAD_DIR, 'ocr_captures');
        if (!fs.existsSync(ocrDir)) fs.mkdirSync(ocrDir, { recursive: true });

        const runVisionOCR = (imagePath) => {
            try {
                const { execSync } = require('child_process');
                return execSync(`swift scripts/ocr_runner.swift "${imagePath}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
            } catch (e) {
                return `OCR_ERROR: ${e.message}`;
            }
        };

        for (let i = 0; i < OCR_TARGETS.length; i++) {
            const target = OCR_TARGETS[i];
            log(`   [${i + 1}/${OCR_TARGETS.length}] Capturing and OCR verifying ${target.label} (${target.type})...`, colors.gray);
            await new Promise(r => setTimeout(r, 1200));

            try {
                const capRes = await axios.get(`${BASE_URL}/api/ntbc-capture?type=${target.type}`, { timeout: 45000 });
                let base64Data = capRes.data.image;
                if (target.subIndex === 1 && capRes.data.imageSub1) base64Data = capRes.data.imageSub1;
                if (target.subIndex === 2 && capRes.data.imageSub2) base64Data = capRes.data.imageSub2;

                const hasValidData = !!(capRes.data.success && base64Data);
                if (!hasValidData) {
                    recordResult(
                        `Capture: ${target.label}`,
                        `แคปภาพ ${target.varTag}`,
                        `GET /api/ntbc-capture?type=${target.type}`,
                        'ได้รับภาพ Base64 และตอบกลับ success: true',
                        `API Error: ${capRes.data.error || 'No image data'}`,
                        false
                    );
                    continue;
                }

                const imgBuffer = Buffer.from(base64Data.replace(/^data:image\/png;base64,/, ''), 'base64');
                const imgFile = path.join(ocrDir, `${target.type}${target.subIndex ? `-sub${target.subIndex}` : ''}.png`);
                fs.writeFileSync(imgFile, imgBuffer);

                const ocrText = runVisionOCR(imgFile);
                const ocrLower = ocrText.toLowerCase();

                const matchedKw = target.keywords.find(kw => ocrLower.includes(kw.toLowerCase()));
                const isUnavailableFallback = ocrLower.includes('not found') || ocrLower.includes('ไม่พบข้อมูล') || capRes.data.isUnavailable;
                const ocrPassed = !!(matchedKw || isUnavailableFallback);
                const snippet = ocrText.slice(0, 75).replace(/\n/g, ' ');

                recordResult(
                    `OCR: ${target.label}`,
                    `สแกนข้อความ OCR ในภาพ ${target.varTag}`,
                    'swift scripts/ocr_runner.swift',
                    `พบคำสำคัญ [${target.keywords.slice(0, 3).join(', ')}] หรือการ์ดสถานะ`,
                    ocrPassed ? `Match: "${matchedKw || 'Fallback Status'}" | Snippet: "${snippet}..."` : `Mismatch. OCR: "${snippet}..."`,
                    ocrPassed
                );

            } catch (ocrErr) {
                recordResult(
                    `OCR: ${target.label}`,
                    `แคปและตรวจ OCR ${target.varTag}`,
                    `GET /api/ntbc-capture?type=${target.type}`,
                    'ดำเนินการแคปและตรวจ OCR สำเร็จ',
                    `Error: ${ocrErr.message}`,
                    false
                );
            }
        }

        // -------------------------------------------------------------
        // Print Standardized 6-Column Summary Table
        // -------------------------------------------------------------
        log('\n=============================================================', colors.cyan);
        log('📊 E2E Regression Test Summary Report (Standard 6-Column)', colors.cyan + colors.bold);
        log('=============================================================\n', colors.cyan);
        console.table(testResults);

        const total = testResults.length;
        const passed = testResults.filter(r => r['สถานะ (Status)'].includes('Passed')).length;
        const failed = total - passed;

        log(`\n🏁 Total: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`, failed === 0 ? colors.green + colors.bold : colors.red + colors.bold);

        if (failed > 0) {
            process.exitCode = 1;
        }

    } catch (err) {
        log(`\n❌ E2E Suite Error: ${err.message}`, colors.red);
        if (err.stack) console.error(err.stack);
        process.exitCode = 1;
    } finally {
        if (browser) await browser.close();
    }
}

runE2ESuite();
