// Shared "@inapp_*" table renderers: the app-generated alternative to a raw captured
// screenshot (naming convention: swap a "@captured_X" variable's "captured_" prefix for
// "inapp_", e.g. "@captured_min_tls_version" -> "@inapp_min_tls_version"). These functions
// are the single source of truth for what an @inapp_* variable actually renders, so both
// the report template engine (page.js's processTemplate) and the live preview tab on the
// screenshot-capture control page (control/page.js) stay in sync.
//
// Font: these tables use Roboto for their own rendering (browser preview + the report's HTML
// output). Roboto isn't loaded globally by the app, so each table embeds its own @import —
// harmless to repeat across multiple tables since the browser dedupes the font fetch/cache.
// NOTE: the Word (.docx) export pipeline (see app/api/export-docx/route.js's
// sanitizeDocxFonts) forcibly rewrites every font in the exported document to "TH SarabunPSK"
// regardless of source CSS, so Roboto shows correctly in the live preview and in the on-screen
// report, but the final exported .docx will still render this text in TH SarabunPSK.
const ROBOTO_FONT_IMPORT = "<style>@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');</style>";

// Generic placeholder ("mockup") table for an @inapp_* variable whose real layout/data has
// not been specified yet.
export const generateMockupTable = (label) => {
    return `${ROBOTO_FONT_IMPORT}<table width="100%" style="width: 100%; border-collapse: collapse; border: 1px dashed #9ca3af; margin-top: 0; margin-bottom: 0; table-layout: fixed;">
        <tbody>
            <tr>
                <td style="border: 1px dashed #9ca3af; padding: 16px; text-align: center; font-family: 'Roboto', sans-serif; font-size: 16pt; color: #6b7280; background-color: #f9fafb;">
                    [Mockup] ${label}<br/>
                    <span style="font-size: 12pt; color: #9ca3af;">รอกำหนดรูปแบบข้อมูลที่ต้องการแสดง</span>
                </td>
            </tr>
        </tbody>
    </table>`;
};

// Placeholder for an @inapp_* variable whose real markup IS implemented (and uses real data)
// in the report engine (page.js's processTemplate, from `safeData`'s already-fetched traffic
// analytics), but is NOT yet wired into this control-page live preview — the live preview only
// has zone *settings* (get-zone-settings), not the heavier traffic/analytics GraphQL data the
// report pulls in separately. Distinct from generateMockupTable so it's clear this isn't
// missing design, just missing a data feed in this one preview surface.
export const generatePreviewNotWiredNote = (label) => {
    return `${ROBOTO_FONT_IMPORT}<table width="100%" style="width: 100%; border-collapse: collapse; border: 1px dashed #6366f1; margin-top: 0; margin-bottom: 0; table-layout: fixed;">
        <tbody>
            <tr>
                <td style="border: 1px dashed #6366f1; padding: 16px; text-align: center; font-family: 'Roboto', sans-serif; font-size: 15pt; color: #4338ca; background-color: #eef2ff;">
                    ${label}<br/>
                    <span style="font-size: 11pt; color: #6366f1;">ตัวอย่างสดหน้านี้ยังไม่ได้ดึงข้อมูล Traffic/Analytics มาแสดง — แต่รายงานจริงที่สร้างออกมาจะมีข้อมูลนี้ถูกต้อง (ดึงจาก safeData ที่มีอยู่แล้ว)</span>
                </td>
            </tr>
        </tbody>
    </table>`;
};

// Generates an HTML table that visually mimics a Cloudflare-style on/off toggle switch.
// Reusable for any @inapp_* variable that is a boolean/toggle-style setting.
export const generateToggleTable = (label, isEnabled, statusText) => {
    const trackColor = isEnabled ? '#86efac' : '#d1d5db';
    const knobColor = isEnabled ? '#16a34a' : '#9ca3af';
    const bgColor = isEnabled ? '#dcfce7' : '#f3f4f6';
    const textColor = isEnabled ? '#166534' : '#4b5563';
    const displayStatus = statusText || (isEnabled ? 'Enabled' : 'Disabled');
    const cellStyle = "border: 1px solid black; padding: 10px 12px; font-family: 'Roboto', sans-serif; font-size: 16pt;";

    return `${ROBOTO_FONT_IMPORT}<table width="100%" style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-top: 0; margin-bottom: 0; table-layout: fixed;">
        <tbody>
            <tr>
                <td style="${cellStyle} width: 65%;">${label}</td>
                <td style="${cellStyle} width: 35%; text-align: center; background-color: ${bgColor};">
                    <table style="border-collapse: collapse; margin: 0 auto;"><tbody><tr>
                        <td style="border: none; padding: 0 6px 0 0; vertical-align: middle;">
                            <table style="border-collapse: collapse; width: 34px; height: 18px; background-color: ${trackColor}; border-radius: 9px;"><tbody>
                                <tr><td style="border: none; padding: 0; text-align: ${isEnabled ? 'right' : 'left'};"><span style="display: inline-block; width: 14px; height: 14px; background-color: ${knobColor}; border-radius: 50%; margin: 2px;">&nbsp;</span></td></tr>
                            </tbody></table>
                        </td>
                        <td style="border: none; padding: 0 0 0 6px; vertical-align: middle; font-family: 'Roboto', sans-serif; font-size: 14pt; font-weight: bold; color: ${textColor};">${displayStatus}</td>
                    </tr></tbody></table>
                </td>
            </tr>
        </tbody>
    </table>`;
};

// Replicates the look of a Cloudflare dashboard "setting card" that shows a dropdown control
// on the right (e.g. Minimum TLS Version) — title + description on the left, a bordered
// dropdown-style box with the current value on the right.
export const generateSettingCardDropdown = (title, description, valueText) => {
    const cellFont = "font-family: 'Roboto', sans-serif;";
    return `${ROBOTO_FONT_IMPORT}<table width="100%" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin-top: 0; margin-bottom: 0; table-layout: fixed;">
        <tbody>
            <tr>
                <td style="border: none; border-right: 1px solid #e5e7eb; padding: 16px 20px; width: 68%; background-color: #ffffff; vertical-align: top;">
                    <div style="${cellFont} font-size: 18pt; font-weight: bold; color: #1f2937; margin-bottom: 6px;">${title}</div>
                    <div style="${cellFont} font-size: 13pt; color: #6b7280; line-height: 1.4;">${description}</div>
                </td>
                <td style="border: none; padding: 16px 20px; width: 32%; background-color: #f3f4f6; vertical-align: middle; text-align: center;">
                    <table style="border-collapse: collapse; margin: 0 auto;"><tbody><tr>
                        <td style="border: 1px solid #d1d5db; background-color: #ffffff; padding: 8px 14px; ${cellFont} font-size: 14pt; color: #374151; white-space: nowrap;">${valueText}&nbsp;&nbsp;▼</td>
                    </tr></tbody></table>
                </td>
            </tr>
        </tbody>
    </table>`;
};

// Replicates the look of a Cloudflare dashboard "setting card" that shows an on/off toggle
// control on the right (e.g. TLS 1.3, Browser Integrity Check, Argo Smart Routing) — title +
// description on the left, a rounded toggle switch on the right, same outer shape as
// generateSettingCardDropdown but with a switch instead of a dropdown box.
export const generateSettingCardToggle = (title, description, isEnabled, statusText) => {
    const cellFont = "font-family: 'Roboto', sans-serif;";
    const trackColor = isEnabled ? '#86efac' : '#d1d5db';
    const knobColor = isEnabled ? '#16a34a' : '#9ca3af';
    const textColor = isEnabled ? '#166534' : '#6b7280';
    const displayStatus = statusText || (isEnabled ? 'Enabled' : 'Disabled');

    return `${ROBOTO_FONT_IMPORT}<table width="100%" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin-top: 0; margin-bottom: 0; table-layout: fixed;">
        <tbody>
            <tr>
                <td style="border: none; border-right: 1px solid #e5e7eb; padding: 16px 20px; width: 68%; background-color: #ffffff; vertical-align: top;">
                    <div style="${cellFont} font-size: 18pt; font-weight: bold; color: #1f2937; margin-bottom: 6px;">${title}</div>
                    <div style="${cellFont} font-size: 13pt; color: #6b7280; line-height: 1.4;">${description}</div>
                </td>
                <td style="border: none; padding: 16px 20px; width: 32%; background-color: #f3f4f6; vertical-align: middle; text-align: center;">
                    <table style="border-collapse: collapse; margin: 0 auto;"><tbody><tr>
                        <td style="border: none; padding: 0 6px 0 0; vertical-align: middle;">
                            <table style="border-collapse: collapse; width: 34px; height: 18px; background-color: ${trackColor}; border-radius: 9px;"><tbody>
                                <tr><td style="border: none; padding: 0; text-align: ${isEnabled ? 'right' : 'left'};"><span style="display: inline-block; width: 14px; height: 14px; background-color: ${knobColor}; border-radius: 50%; margin: 2px;">&nbsp;</span></td></tr>
                            </tbody></table>
                        </td>
                        <td style="border: none; padding: 0 0 0 6px; vertical-align: middle; ${cellFont} font-size: 13pt; font-weight: bold; color: ${textColor};">${displayStatus}</td>
                    </tr></tbody></table>
                </td>
            </tr>
        </tbody>
    </table>`;
};

// Replicates a Cloudflare "feature card with pill tags + a counter badge" layout, e.g. Bot
// Management's "Super Bot Fight Mode" card (title, description, a row of pill-shaped tags,
// and a rounded counter badge on the far right).
export const generateTagCounterCard = (title, description, tags, badgeText) => {
    const cellFont = "font-family: 'Roboto', sans-serif;";
    const tagList = Array.isArray(tags) ? tags : [];
    const tagsHtml = tagList.map(t => (
        `<span style="display: inline-block; ${cellFont} font-size: 11pt; color: #374151; background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 12px; margin: 2px 6px 2px 0;"><span style="position: relative; top: -7px; display: inline-block; line-height: 1; white-space: nowrap;">${t}</span></span>`
    )).join('');

    return `${ROBOTO_FONT_IMPORT}<table width="100%" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin-top: 0; margin-bottom: 0; table-layout: fixed;">
        <tbody>
            <tr>
                <td style="border: none; border-right: 1px solid #e5e7eb; padding: 16px 20px; width: 78%; background-color: #ffffff; vertical-align: top;">
                    <div style="${cellFont} font-size: 18pt; font-weight: bold; color: #1f2937; margin-bottom: 6px;">${title}</div>
                    <div style="${cellFont} font-size: 13pt; color: #6b7280; line-height: 1.4; margin-bottom: 10px;">${description}</div>
                    <div>${tagsHtml}</div>
                </td>
                <td style="border: none; padding: 16px 20px; width: 22%; background-color: #f3f4f6; vertical-align: middle; text-align: center;">
                    <div style="display: inline-block; width: 40px; height: 40px; line-height: 40px; border-radius: 50%; background-color: #e0e7ff; color: #4338ca; ${cellFont} font-size: 16pt; font-weight: bold;">${badgeText}</div>
                </td>
            </tr>
        </tbody>
    </table>`;
};

// A simple horizontal row of stat boxes (label above value), for pages that are mostly
// numeric summaries in the real dashboard (e.g. HTTP Traffic sidebar stats, DNS record count,
// Security Analytics overview) but don't have a single settings value to show.
export const generateStatGrid = (title, stats) => {
    const cellFont = "font-family: 'Roboto', sans-serif;";
    const list = Array.isArray(stats) ? stats : [];
    const cellsHtml = list.map(s => (
        `<td style="border: 1px solid #e5e7eb; padding: 12px 10px; text-align: center; background-color: #ffffff; vertical-align: top;">
            <div style="${cellFont} font-size: 11pt; color: #6b7280; margin-bottom: 4px;">${s.label}</div>
            <div style="${cellFont} font-size: 16pt; font-weight: bold; color: #1f2937;">${s.value}</div>
        </td>`
    )).join('');

    return `${ROBOTO_FONT_IMPORT}<table width="100%" style="width: 100%; border-collapse: collapse; border: none; margin-top: 0; margin-bottom: 0; table-layout: fixed;">
        <tbody>
            <tr><td colspan="${list.length || 1}" style="border: none; padding: 0 0 8px 0; ${cellFont} font-size: 15pt; font-weight: bold; color: #1f2937;">${title}</td></tr>
            <tr>${cellsHtml || `<td style="border: 1px solid #e5e7eb; padding: 16px; text-align: center; color: #9ca3af; ${cellFont} font-size: 12pt;">No data</td>`}</tr>
        </tbody>
    </table>`;
};

// Renders the Speed Test tab's live preview from a `check-speed-results` scrape response
// (there is no public Cloudflare REST API for Speed Test results — this app already reads the
// score straight out of the live Cloudflare dashboard's DOM via the debug browser session, which
// is more reliable than OCR-ing a screenshot and needs no extra image-processing dependency).
// `result` is that action's response shape: { status, score?, message?, error? }.
export const generateSpeedResultCard = (result) => {
    const cellFont = "font-family: 'Roboto', sans-serif;";
    const r = result || {};

    if (r.status === 'completed' || r.status === 'completed_in_table') {
        return generateStatGrid('Speed Test Result', [
            { label: 'Score', value: r.score || 'Available' },
        ]);
    }

    const statusText = {
        running: 'กำลังรันการทดสอบความเร็ว...',
        waiting: 'รอผลการทดสอบความเร็ว...',
        error: `ทดสอบไม่สำเร็จ${r.error ? `: ${r.error}` : ''}`,
    }[r.status] || 'ยังไม่มีผลการทดสอบความเร็วในเบราว์เซอร์สด (เปิดหน้า Speed Test ในไลฟ์เบราว์เซอร์ก่อน แล้วกดรีเฟรชตัวอย่างนี้)';

    return `${ROBOTO_FONT_IMPORT}<table width="100%" style="width: 100%; border-collapse: collapse; border: 1px dashed #9ca3af; margin-top: 0; margin-bottom: 0; table-layout: fixed;">
        <tbody>
            <tr>
                <td style="border: 1px dashed #9ca3af; padding: 16px; text-align: center; ${cellFont} font-size: 14pt; color: #6b7280; background-color: #f9fafb;">
                    Speed Test<br/>
                    <span style="font-size: 11pt; color: #9ca3af;">${statusText}</span>
                    ${r.previousScore ? `<br/><span style="font-size: 11pt; color: #6b7280;">ผลก่อนหน้า: ${r.previousScore}</span>` : ''}
                </td>
            </tr>
        </tbody>
    </table>`;
};

// Maps a rule/setting status string to the same colour language Cloudflare uses in its rule
// list tables (green = active/enabled, red = block, gray = disabled/skip, blue = log, orange =
// challenge).
const statusPillStyle = (status) => {
    const s = (status || '').toString().toLowerCase();
    if (['active', 'enabled', 'on', 'healthy', 'yes'].includes(s)) return 'color: #166534; background-color: #dcfce7;';
    if (['block', 'blocked', 'unhealthy'].includes(s)) return 'color: #991b1b; background-color: #fee2e2;';
    if (['log'].includes(s)) return 'color: #1e40af; background-color: #dbeafe;';
    if (['managed challenge', 'challenge'].includes(s)) return 'color: #92400e; background-color: #fef3c7;';
    return 'color: #4b5563; background-color: #f3f4f6;'; // disabled / skip / unknown / no
};

// Replicates a Cloudflare rule-list table (Security Rules, Rate Limiting, Managed Rules, IP
// Access Rules, etc.): a header row of column labels, then one row per rule with the last
// column rendered as a coloured status pill. Falls back to a "no rules configured" row when
// there is no real data yet.
export const generateRuleListTable = (title, columns, rows, emptyText) => {
    const cellFont = "font-family: 'Roboto', sans-serif;";
    const cols = Array.isArray(columns) ? columns : [];
    const data = Array.isArray(rows) ? rows : [];
    const maxRows = 8;

    const headerHtml = cols.map(c => (
        `<td style="border: 1px solid #e5e7eb; padding: 8px 10px; background-color: #f9fafb; ${cellFont} font-size: 11pt; font-weight: bold; color: #374151;">${c.label}</td>`
    )).join('');

    const bodyHtml = data.slice(0, maxRows).map(row => {
        const cellsHtml = cols.map((c, idx) => {
            const raw = row[c.key];
            const value = (raw === undefined || raw === null || raw === '') ? '-' : raw;
            const isStatusCol = ['status', 'action', 'health', 'enabled', 'proxied'].includes(c.key);
            const pillStyle = isStatusCol ? statusPillStyle(value) : '';
            const inner = isStatusCol
                ? `<span style="display: inline-block; padding: 4px 10px; border-radius: 999px; ${pillStyle}"><span style="position: relative; top: -8px; display: inline-block; font-weight: bold; font-size: 10pt; line-height: 1; white-space: nowrap;">${value}</span></span>`
                : value;
            return `<td style="border: 1px solid #e5e7eb; padding: 8px 10px; ${cellFont} font-size: 11pt; color: #1f2937; ${idx === 0 ? 'font-weight: 600;' : ''}">${inner}</td>`;
        }).join('');
        return `<tr>${cellsHtml}</tr>`;
    }).join('');

    const moreRowHtml = data.length > maxRows
        ? `<tr><td colspan="${cols.length}" style="border: 1px solid #e5e7eb; padding: 6px 10px; text-align: center; ${cellFont} font-size: 10pt; color: #9ca3af;">+${data.length - maxRows} เพิ่มเติม...</td></tr>`
        : '';

    const emptyRowHtml = data.length === 0
        ? `<tr><td colspan="${cols.length || 1}" style="border: 1px solid #e5e7eb; padding: 16px; text-align: center; ${cellFont} font-size: 12pt; color: #9ca3af;">${emptyText || 'ไม่มีการตั้งค่ากฎในระบบ (No rules configured)'}</td></tr>`
        : '';

    return `${ROBOTO_FONT_IMPORT}<table width="100%" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin-top: 0; margin-bottom: 0;">
        <tbody>
            <tr><td colspan="${cols.length || 1}" style="border: none; padding: 0 0 8px 0; ${cellFont} font-size: 15pt; font-weight: bold; color: #1f2937;">${title}</td></tr>
            <tr>${headerHtml}</tr>
            ${bodyHtml}
            ${moreRowHtml}
            ${emptyRowHtml}
        </tbody>
    </table>`;
};

// Maps a screenshot-capture control-page tab id to its @inapp_* variable's label and render
// function, given the zone settings fetched from the "get-zone-settings" API action (the same
// shape as app/api/scrape/route.js's `get-zone-settings` response `data`). Add real per-setting
// logic here as each variable's required layout/data gets specified (see minTlsVersion for a
// finished example) — everything else still falls back to a neutral mockup placeholder.
const capitalizeWord = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Same logic as page.js's private getCountryName(): Cloudflare's traffic-analytics dimensions
// give a 2-letter region code (clientCountryName), not a display name — resolve it the same
// way here so the control-page live preview matches the generated report's wording.
const resolveCountryName = (code) => {
    try {
        if (!code || code === 'T1' || code === 'XX' || code === 'Unknown' || code === 'Tor') return code || 'Unknown';
        const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
        return displayNames.of(code) || code;
    } catch (e) {
        return code;
    }
};

export const getInappPreviewHtml = (tabId, zoneSettings, extra) => {
    const zs = zoneSettings || {};
    const ex = extra || {};
    switch (tabId) {
        case 'minTlsVersion':
            return generateSettingCardDropdown(
                'Minimum TLS Version',
                'Only allow HTTPS connections from visitors that support the selected TLS protocol version or newer.',
                zs.minTlsVersion && zs.minTlsVersion !== 'unknown' ? `TLS ${zs.minTlsVersion}` : 'Unknown'
            );

        case 'tls13':
            return generateSettingCardToggle(
                'TLS 1.3',
                'The latest version of TLS improves security and reduces connection latency for encrypted connections to your website.',
                zs.tls13 === 'on' || zs.tls13 === 'zrt'
            );

        case 'browserIntegrity':
            return generateSettingCardToggle(
                'Browser Integrity Check',
                'Evaluate HTTP headers commonly abused by spammers and denies access to your page based on this information.',
                zs.browserIntegrityCheck === 'on'
            );

        case 'sslOverview':
            return generateSettingCardDropdown(
                'SSL/TLS Encryption Mode',
                'Choose the SSL/TLS encryption mode for connections between visitors, Cloudflare, and your origin server.',
                zs.sslMode ? capitalizeWord(zs.sslMode) : 'Unknown'
            );

        case 'securityLevel':
            return generateSettingCardDropdown(
                'Security Level',
                'Choose the appropriate security profile for your website, which will automatically adjust each Cloudflare security setting.',
                zs.securityLevel ? capitalizeWord(zs.securityLevel) : 'Medium'
            );

        case 'argo':
            return generateSettingCardToggle(
                'Argo Smart Routing',
                'Argo is a service that uses optimized routes across the Cloudflare network to deliver responses to your users more quickly, reliably, and securely.',
                !!zs.argoSmartRouting
            );

        case 'botManagement': {
            const bm = zs.botManagement || {};
            const tags = bm.superBotFightMode
                ? ['Super Bot Fight Mode', 'Bot traffic', 'DDoS attacks']
                : ['Bot traffic', 'DDoS attacks'];
            const badgeText = bm.enabled ? 'ON' : 'OFF';
            return generateTagCounterCard(
                'Bot Management',
                'Detect and mitigate automated traffic to protect your domain from bad bots, using machine-learning models trained on Cloudflare\'s network.',
                tags,
                badgeText
            );
        }

        case 'dns':
            return generateStatGrid('DNS Records', [
                { label: 'Total Records', value: zs.dnsRecordsCount ?? '-' },
            ]);

        case 'zoneLockdown':
            return generateStatGrid('Zone Lockdown Rules', [
                { label: 'Configured Rules', value: zs.zoneLockdownRules ?? 0 },
            ]);

        case 'firewall': {
            const ddosEnabled = zs.ddosProtection?.enabled;
            const ddosLabel = ddosEnabled === true ? 'Enabled' : ddosEnabled === false ? 'Disabled' : 'Unknown';
            return generateStatGrid('Security Analytics Overview', [
                { label: 'DDoS Protection', value: ddosLabel },
                { label: 'Leaked Credentials Check', value: zs.leakedCredentials === 'on' ? 'Enabled' : 'Disabled' },
                { label: 'Zone Lockdown Rules', value: zs.zoneLockdownRules ?? 0 },
                { label: 'Hotlink Protection', value: zs.hotlinkProtection === 'on' ? 'Enabled' : 'Disabled' },
            ]);
        }

        case 'securityRules': {
            const cr = zs.customRules || { status: 'None', rules: [] };
            return generateRuleListTable(
                `Security Rules — Custom Rules (${cr.status || 'None'})`,
                [
                    { key: 'description', label: 'Name / Description' },
                    { key: 'action', label: 'Action' },
                    { key: 'status', label: 'Status' },
                ],
                cr.rules
            );
        }

        case 'rateLimiting': {
            const rl = zs.rateLimits || { status: 'None', rules: [] };
            return generateRuleListTable(
                `Rate Limiting Rules (${rl.status || 'None'})`,
                [
                    { key: 'description', label: 'Name / Description' },
                    { key: 'match', label: 'Match' },
                    { key: 'action', label: 'Action' },
                    { key: 'status', label: 'Status' },
                ],
                rl.rules
            );
        }

        case 'managedRules': {
            const wr = zs.wafManagedRules || {};
            const rows = [
                { description: 'Cloudflare Managed Ruleset', action: 'Execute', status: wr.cloudflareManaged ? 'Active' : 'Disabled' },
                { description: 'Cloudflare OWASP Core Ruleset', action: 'Execute', status: wr.owaspCore ? 'Active' : 'Disabled' },
            ];
            return generateRuleListTable(
                `Managed Rules (${wr.managedRulesCount ?? rows.filter(r => r.status === 'Active').length} active)`,
                [
                    { key: 'description', label: 'Name' },
                    { key: 'action', label: 'Action' },
                    { key: 'status', label: 'Status' },
                ],
                rows
            );
        }

        case 'ipAccess':
            return generateRuleListTable(
                'IP Access Rules',
                [
                    { key: 'ip', label: 'IP / Value' },
                    { key: 'action', label: 'Action' },
                    { key: 'scope', label: 'Scope' },
                    { key: 'notes', label: 'Notes' },
                ],
                zs.ipAccessRules,
                'ไม่มีการตั้งค่า IP Access Rules'
            );

        case 'domains':
            return generateStatGrid('Sites Overview', [
                { label: 'Domain', value: ex.zoneName || 'Unknown' },
                { label: 'Account', value: ex.accountName || 'Unknown' },
                { label: 'SSL Mode', value: zs.sslMode && zs.sslMode !== 'unknown' ? capitalizeWord(zs.sslMode) : 'Unknown' },
                { label: 'DNS Records', value: zs.dnsRecordsCount ?? '-' },
            ]);

        case 'traffic': {
            const td = ex.trafficData;
            if (!td) return generatePreviewNotWiredNote('HTTP Traffic Overview');
            return generateStatGrid('HTTP Traffic Overview', [
                { label: 'Total Requests', value: td.zoneTotalRequests },
                { label: 'Total Bandwidth', value: td.zoneTotalDataTransfer },
                { label: 'Page Views', value: (td.pageViews || 0).toLocaleString() },
                { label: 'Visits', value: (td.visits || 0).toLocaleString() },
            ]);
        }
        case 'trafficCountries': {
            const td = ex.trafficData;
            if (!td) return generatePreviewNotWiredNote('Traffic by Country');
            return generateRuleListTable(
                'Traffic by Country',
                [
                    { key: 'country', label: 'Country' },
                    { key: 'count', label: 'Requests' },
                ],
                (td.topCountries || []).slice(0, 8).map(c => ({
                    country: resolveCountryName(c.name),
                    count: (c.count || 0).toLocaleString(),
                })),
                'ไม่มีข้อมูลประเทศในช่วงเวลานี้'
            );
        }
        case 'topEventsSource': {
            const td = ex.trafficData;
            if (!td) return generatePreviewNotWiredNote('Top Events by Source');
            return generateStatGrid('Top Events by Source', [
                { label: 'Total Events', value: td.fwEvents?.total ?? 0 },
                { label: 'Managed Rules', value: td.fwEvents?.managed ?? 0 },
                { label: 'Custom Rules', value: td.fwEvents?.custom ?? 0 },
                { label: 'Browser Integrity', value: td.fwEvents?.bic ?? 0 },
                { label: 'IP Access', value: td.fwEvents?.access ?? 0 },
            ]);
        }
        case 'loadBalancingSpectrum':
            return generateRuleListTable(
                'Manage Public Load Balancers',
                [
                    { key: 'health', label: 'Health' },
                    { key: 'hostname', label: 'Hostname' },
                    { key: 'availablePools', label: 'Available Pools' },
                    { key: 'ttl', label: 'TTL' },
                    { key: 'proxied', label: 'Proxied' },
                    { key: 'enabled', label: 'Enabled' },
                ],
                ex.loadBalancers,
                'ไม่มีการตั้งค่า Load Balancer ในโซนนี้'
            );
        case 'speed': return generateSpeedResultCard(ex.speedResult);
        default: return generateMockupTable(tabId || 'Unknown');
    }
};
