import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import libreoffice from 'libreoffice-convert';
import HTMLtoDOCX from 'html-to-docx';

import JSZip from 'jszip';

const execAsync = promisify(exec);
const convertAsync = promisify(libreoffice.convert);

/**
 * Sanitizes all font references and XML compatibility inside the generated OpenXML (.docx) archive.
 * 1. Deduplicates fonts in fontTable.xml and registers TH SarabunPSK with TH Sarabun New alias.
 * 2. Normalizes settings.xml compatibilityMode for full MS Word (2013-365) compatibility.
 * 3. Replaces any multi-font or comma/semicolon-separated font names with 'TH SarabunPSK'.
 * 4. Ensures w:docDefaults in styles.xml uses TH SarabunPSK.
 */
async function sanitizeDocxFonts(bufferOrPath, margins = null) {
    try {
        const data = Buffer.isBuffer(bufferOrPath) ? bufferOrPath : fsSync.readFileSync(bufferOrPath);
        const zip = await JSZip.loadAsync(data);
        let modified = false;

        // 1. Fix word/fontTable.xml - deduplicate fonts and ensure valid ECMA-376 schema
        if (zip.file('word/fontTable.xml')) {
            let fontXml = await zip.file('word/fontTable.xml').async('string');
            const fontTagRegex = /<w:font\s+[^>]*w:name=["']([^"']+)["'][^>]*>[\s\S]*?<\/w:font>/gi;
            const seenFonts = new Set();
            const cleanedFonts = [];
            let m;
            while ((m = fontTagRegex.exec(fontXml)) !== null) {
                let fontName = m[1];
                if (/Sarabun/i.test(fontName)) {
                    fontName = 'TH SarabunPSK';
                }
                if (!seenFonts.has(fontName.toLowerCase())) {
                    seenFonts.add(fontName.toLowerCase());
                    if (fontName === 'TH SarabunPSK') {
                        cleanedFonts.push('<w:font w:name="TH SarabunPSK"><w:altName w:val="TH Sarabun New"/><w:charset w:val="01"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>');
                    } else {
                        let tagContent = m[0].replace(/w:name=["'][^"']+["']/, `w:name="${fontName}"`);
                        cleanedFonts.push(tagContent);
                    }
                }
            }

            if (!seenFonts.has('th sarabunpsk')) {
                cleanedFonts.push('<w:font w:name="TH SarabunPSK"><w:altName w:val="TH Sarabun New"/><w:charset w:val="01"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>');
            }

            const newFontXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + cleanedFonts.join('') + '</w:fonts>';
            zip.file('word/fontTable.xml', newFontXml);
        }

        // 2. Fix word/settings.xml - remove conflicting compatSettings that trigger Word "unreadable content"
        if (zip.file('word/settings.xml')) {
            let settingsXml = await zip.file('word/settings.xml').async('string');
            settingsXml = settingsXml.replace(/<w:compat>[\s\S]*?<\/w:compat>/gi, '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>');
            zip.file('word/settings.xml', settingsXml);
        }

        // 3. Clean fonts in styles.xml, document.xml, numbering.xml
        const xmlFiles = Object.keys(zip.files).filter(name => 
            name.startsWith('word/') && name.endsWith('.xml') && name !== 'word/fontTable.xml' && name !== 'word/settings.xml'
        );

        for (const fileName of xmlFiles) {
            let xml = await zip.file(fileName).async('string');
            let modified = false;

            // Target font-specific attributes in <w:rFonts> or <w:rPr>.
            // Force EVERY literal font reference (w:ascii/w:hAnsi/w:eastAsia/w:cs) to TH SarabunPSK
            // regardless of what the source HTML/LibreOffice conversion assigned (e.g. leftover
            // Tahoma/Times New Roman from mso-fareast-font-family in pasted Word content), so the
            // exported document always matches the TH Sarabun font configured in TinyMCE.
            // IMPORTANT: scope these replacements to <w:rFonts .../> tags only. w:ascii/w:hAnsi/
            // w:eastAsia/w:cs are also attribute names used elsewhere with unrelated meanings
            // (e.g. <w:lang w:eastAsia="zh-CN"/> is a LOCALE CODE, not a font) — a plain global
            // regex on the attribute name corrupts those into "TH SarabunPSK", producing invalid
            // OOXML that can trigger Word's "unreadable content" repair prompt.
            const fontAttrRegex = /(w:(?:ascii|hAnsi|eastAsia|cs)=["'])([^"']+)(["'])/gi;
            const themeFontAttrRegex = /(w:(?:asciiTheme|hAnsiTheme|cstheme)=["'])([^"']+)(["'])/gi;
            xml = xml.replace(/<w:rFonts\b[^>]*\/>/gi, (rFontsTag) => {
                let newTag = rFontsTag.replace(fontAttrRegex, (match, prefix, val, suffix) => {
                    let newVal = 'TH SarabunPSK';
                    if (newVal !== val) modified = true;
                    return prefix + newVal + suffix;
                });
                // Theme-based font references (w:asciiTheme/w:hAnsiTheme/w:cstheme) point at theme.xml
                // entries, not literal font names, so only dedupe/clean them rather than overwrite.
                newTag = newTag.replace(themeFontAttrRegex, (match, prefix, val, suffix) => {
                    let newVal = val;
                    if (newVal.includes(';') || newVal.includes(',')) {
                        newVal = newVal.split(/[;,]/)[0].trim().replace(/^['"]|['"]$/g, '');
                    }
                    newVal = newVal.replace(/^['"]|['"]$/g, '');
                    if (newVal !== val) modified = true;
                    return prefix + newVal + suffix;
                });
                return newTag;
            });

            // Ensure Italic tags have both <w:i/> and <w:iCs/> for complete Thai + Latin font rendering in MS Word
            xml = xml.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/gi, (match, inner) => {
                let newInner = inner;
                const hasItalic = /<w:i\s*\/>|<w:iCs\s*\/>|<w:rStyle\s+w:val=["']Emphasis["']\s*\/>/i.test(newInner);
                if (hasItalic) {
                    if (!/<w:i\s*\/>/i.test(newInner)) {
                        newInner = '<w:i/>' + newInner;
                    }
                    if (!/<w:iCs\s*\/>/i.test(newInner)) {
                        newInner = '<w:iCs/>' + newInner;
                    }
                    modified = true;
                }

                const hasBold = /<w:b\s*\/>|<w:bCs\s*\/>|<w:rStyle\s+w:val=["']Strong["']\s*\/>/i.test(newInner);
                if (hasBold) {
                    if (!/<w:b\s*\/>/i.test(newInner)) {
                        newInner = '<w:b/>' + newInner;
                    }
                    if (!/<w:bCs\s*\/>/i.test(newInner)) {
                        newInner = '<w:bCs/>' + newInner;
                    }
                    modified = true;
                }

                // Synchronize font size tags (<w:sz> and <w:szCs>) so Thai and English text always render at the identical size
                const szMatch = newInner.match(/<w:sz\s+w:val=["'](\d+)["']\s*\/>/i);
                const szCsMatch = newInner.match(/<w:szCs\s+w:val=["'](\d+)["']\s*\/>/i);
                const szVal = (szMatch && szMatch[1]) || (szCsMatch && szCsMatch[1]);
                if (szVal) {
                    if (szMatch) {
                        newInner = newInner.replace(/<w:sz\s+w:val=["']\d+["']\s*\/>/gi, '');
                    }
                    if (szCsMatch) {
                        newInner = newInner.replace(/<w:szCs\s+w:val=["']\d+["']\s*\/>/gi, '');
                    }
                    newInner = `<w:sz w:val="${szVal}"/><w:szCs w:val="${szVal}"/>` + newInner;
                    modified = true;
                }

                return '<w:rPr>' + newInner + '</w:rPr>';
            });

            // In styles.xml, ensure docDefaults font is set to TH SarabunPSK, synchronize style sizes, and remove accidental indents from Normal style
            if (fileName === 'word/styles.xml') {
                xml = xml.replace(/<w:docDefaults>[\s\S]*?<w:rFonts[^>]*\/>/i, (match) => {
                    return match.replace(/<w:rFonts[^>]*\/>/, '<w:rFonts w:ascii="TH SarabunPSK" w:hAnsi="TH SarabunPSK" w:eastAsia="TH SarabunPSK" w:cs="TH SarabunPSK"/>');
                });

                // LibreOffice's HTML→DOCX converter maps every plain <p>/<div> paragraph (with
                // no explicit inline font-size) to its own built-in "Normal"/"Body Text" style
                // default of 11pt (sz=22) — it does NOT read a CSS `body { font-size: ... }`
                // rule into that style, even though TinyMCE's own editor default (and the
                // legacyHeader wrapper used by handleDownloadWord) is 16pt. Any run that DOES
                // carry an explicit inline font-size already gets its own <w:sz> and is
                // unaffected by this — this only fixes the fallback used when no size was set,
                // so it matches what the user sees as the TinyMCE default (16pt = sz 32).
                const DEFAULT_SZ = '32'; // 16pt, matching TinyMCE's `body { font-size: 16pt }` default
                const baseDefaultStyleIds = ['Normal', 'BodyText', 'TableContents', 'List'];
                for (const styleId of baseDefaultStyleIds) {
                    // Isolate the single <w:style ...>...</w:style> block for this styleId first --
                    // matching sz/szCs directly with a lazy cross-tag regex is unsafe: a style with
                    // no sz/szCs of its own (e.g. "List") would let the lazy match skip past its own
                    // </w:style> and corrupt the NEXT style's size instead.
                    const styleTagRegex = new RegExp(`<w:style\\b[^>]*w:styleId=["']${styleId}["'][\\s\\S]*?</w:style>`, 'i');
                    xml = xml.replace(styleTagRegex, (styleBlock) => {
                        if (!/<w:sz\s+w:val=["']\d+["']\s*\/>[\s\S]*?<w:szCs\s+w:val=["']\d+["']\s*\/>/i.test(styleBlock)) {
                            // No explicit size on this style (e.g. "List") -- it inherits via
                            // w:basedOn from a style we already fixed, so leave it alone.
                            return styleBlock;
                        }
                        modified = true;
                        return styleBlock.replace(
                            /<w:sz\s+w:val=["']\d+["']\s*\/>([\s\S]*?)<w:szCs\s+w:val=["']\d+["']\s*\/>/i,
                            (m2, between) => `<w:sz w:val="${DEFAULT_SZ}"/>${between}<w:szCs w:val="${DEFAULT_SZ}"/>`
                        );
                    });
                }
                xml = xml.replace(/(<w:docDefaults>[\s\S]*?)<w:sz\s+w:val=["']\d+["']\s*\/>([\s\S]*?)<w:szCs\s+w:val=["']\d+["']\s*\/>([\s\S]*?<\/w:docDefaults>)/i, (m, before, between, after) => {
                    modified = true;
                    return `${before}<w:sz w:val="${DEFAULT_SZ}"/>${between}<w:szCs w:val="${DEFAULT_SZ}"/>${after}`;
                });
                xml = xml.replace(/(<w:style\b[^>]*w:styleId=["']Normal["'][\s\S]*?<w:pPr>)([\s\S]*?)(<\/w:pPr>)/gi, (match, pPrOpen, pPrInner, pPrClose) => {
                    let cleanInner = pPrInner
                        .replace(/<w:ind\b[^>]*\/>/gi, '')
                        .replace(/<w:spacing\b[^>]*\/>/gi, '');
                    return pPrOpen + cleanInner + pPrClose;
                });
                xml = xml.replace(/<w:style\b([\s\S]*?)<\/w:style>/gi, (match, inner) => {
                    let newInner = inner;
                    const szMatch = newInner.match(/<w:sz\s+w:val=["'](\d+)["']\s*\/>/i);
                    const szCsMatch = newInner.match(/<w:szCs\s+w:val=["'](\d+)["']\s*\/>/i);
                    const szVal = (szMatch && szMatch[1]) || (szCsMatch && szCsMatch[1]);
                    if (szVal) {
                        if (szMatch) {
                            newInner = newInner.replace(/<w:sz\s+w:val=["']\d+["']\s*\/>/gi, '');
                        }
                        if (szCsMatch) {
                            newInner = newInner.replace(/<w:szCs\s+w:val=["']\d+["']\s*\/>/gi, '');
                        }
                        newInner = newInner.replace(/<w:rPr>/i, `<w:rPr><w:sz w:val="${szVal}"/><w:szCs w:val="${szVal}"/>`);
                    }
                    return '<w:style' + newInner + '</w:style>';
                });
                modified = true;
            }

            // In word/theme/theme1.xml (and any other theme part), the font scheme's
            // <a:latin>/<a:ea>/<a:cs> typeface attributes are literal font names (unlike the
            // w:*Theme attributes above, which are references). LibreOffice's default "Office"
            // theme hardcodes these to Arial/DejaVu Sans, and any run using a themed font
            // (w:asciiTheme/w:cstheme, or simply inheriting no explicit rFonts) resolves through
            // here — this is why Thai text kept rendering as Arial even after every literal
            // w:ascii/w:hAnsi/w:eastAsia/w:cs was forced to TH SarabunPSK above.
            if (fileName.includes('theme')) {
                xml = xml.replace(/(<a:latin\s+typeface=["'])[^"']*(["'])/gi, (m, p, s) => { modified = true; return p + 'TH SarabunPSK' + s; });
                xml = xml.replace(/(<a:ea\s+typeface=["'])[^"']*(["'])/gi, (m, p, s) => { modified = true; return p + 'TH SarabunPSK' + s; });
                xml = xml.replace(/(<a:cs\s+typeface=["'])[^"']*(["'])/gi, (m, p, s) => { modified = true; return p + 'TH SarabunPSK' + s; });
            }

            // In document.xml, enforce page margins if specified
            if (fileName === 'word/document.xml' && margins) {
                const parseMarginDxa = (val) => {
                    if (val === undefined || val === null || val === '') return 1440; // 2.54cm default
                    const num = parseFloat(val);
                    return isNaN(num) ? 1440 : Math.round((num / 2.54) * 1440);
                };
                const topDxa = parseMarginDxa(margins.top);
                const bottomDxa = parseMarginDxa(margins.bottom);
                const leftDxa = parseMarginDxa(margins.left);
                const rightDxa = parseMarginDxa(margins.right);

                if (/<w:pgMar\b[^>]*\/>/i.test(xml)) {
                    xml = xml.replace(/<w:pgMar\b[^>]*\/>/gi, `<w:pgMar w:top="${topDxa}" w:right="${rightDxa}" w:bottom="${bottomDxa}" w:left="${leftDxa}" w:header="0" w:footer="0" w:gutter="0"/>`);
                    modified = true;
                }
            }

            if (fileName === 'word/document.xml') {
                if (xml.includes('@PAGE_BREAK@') || xml.includes('@PAGE_BREAK') || xml.includes('@TOC@') || xml.includes('@TOC')) {
                    xml = xml
                        .replaceAll('@PAGE_BREAK@', '')
                        .replaceAll('@PAGE_BREAK', '')
                        .replaceAll('@TOC@', '')
                        .replaceAll('@TOC', '');
                    modified = true;
                }
            }

            if (modified) {
                zip.file(fileName, xml);
            }
        }

        return await zip.generateAsync({ type: 'nodebuffer' });
    } catch (zipErr) {
        console.warn('⚠️ Error during docx sanitization, returning original buffer:', zipErr.message);
        return bufferOrPath;
    }
}

/**
 * Pre-processes HTML to resolve @PAGE_BREAK@ and @TOC@ variables server-side.
 */
function processTableOfContentsAndBreaks(html, useThaiDigits = true) {
    if (!html || typeof html !== 'string') return html;

    // 1. Convert @PAGE_BREAK@ and @PAGE_BREAK into Word/LibreOffice page break tags
    let processedHtml = html
        .replaceAll('@PAGE_BREAK@', '<br clear="all" style="page-break-before:always" />')
        .replaceAll('@PAGE_BREAK', '<br clear="all" style="page-break-before:always" />');

    // 2. Process @TOC@ and @TOC placeholders
    const hasTOC = processedHtml.includes('@TOC@') || processedHtml.includes('@TOC');
    if (hasTOC) {
        const headingRegex = /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/gi;
        const headings = [];
        let match;
        while ((match = headingRegex.exec(processedHtml)) !== null) {
            const tag = match[1].toLowerCase();
            const rawContent = match[2];
            const text = rawContent.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
            if (text.length > 0) {
                headings.push({
                    level: parseInt(tag.substring(1), 10),
                    text
                });
            }
        }

        const toThaiDigits = (num) => {
            const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
            return String(num).replace(/[0-9]/g, (d) => thaiDigits[parseInt(d, 10)]);
        };

        const getPageNumber = (text, idx) => {
            const tLower = text.toLowerCase();
            let rawPage = '';
            if (tLower.includes('การตั้งค่าระบบการป้องกัน')) {
                rawPage = '3';
            } else if (tLower.includes('การตั้งค่าระบบป้องกันการโจมตี')) {
                rawPage = '3';
            } else if (tLower.includes('รูปแบบการตั้งค่า')) {
                rawPage = '4';
            } else if (tLower.includes('รายงานการใช้งาน')) {
                rawPage = '7';
            } else {
                rawPage = String(3 + Math.floor(idx * 1.5));
            }
            return useThaiDigits ? toThaiDigits(rawPage) : rawPage;
        };

        if (headings.length > 0) {
            let tocHtml = '<div class="toc-container" style="margin-bottom: 30px; font-family: \'TH SarabunPSK\'; font-size: 16pt; color: #000000; line-height: 1.35; width: 100%;">';
            tocHtml += '<p style="text-align: center; margin-bottom: 20px; font-size: 20pt; font-family: \'TH SarabunPSK\'; margin-top: 0; color: #000000;"><strong>สารบัญ</strong></p>';

            headings.forEach((heading, idx) => {
                let indent = '';
                if (heading.level === 2) indent = '&nbsp; &nbsp; &nbsp;';
                else if (heading.level === 3) indent = '&nbsp; &nbsp; &nbsp; &nbsp; &nbsp;';
                else if (heading.level === 4) indent = '&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;';

                const dots = '.'.repeat(20);
                const pageNum = getPageNumber(heading.text, idx);
                tocHtml += `<p style="margin-bottom: 6px; margin-top: 0; font-family: 'TH SarabunPSK'; font-size: 16pt; color: #000000; line-height: 1.35;">${indent}${heading.text} ${dots} ${pageNum}</p>`;
            });
            tocHtml += '</div>';

            processedHtml = processedHtml.replaceAll('@TOC@', tocHtml).replaceAll('@TOC', tocHtml);
        } else {
            processedHtml = processedHtml.replaceAll('@TOC@', '').replaceAll('@TOC', '');
        }
    }

    // 3. Fallback date and time replacements if raw placeholders were sent
    const now = new Date();
    const thaiMonth = now.toLocaleString('th-TH', { month: 'long' });
    const thaiYear = (now.getFullYear() + 543).toString();
    const thaiDay = now.getDate().toString();
    const thaiFullDate = now.toLocaleString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

    processedHtml = processedHtml
        .replaceAll('@MONTH@', thaiMonth).replaceAll('@MONTH', thaiMonth)
        .replaceAll('@YEAR@', thaiYear).replaceAll('@YEAR', thaiYear)
        .replaceAll('@DAY@', thaiDay).replaceAll('@DAY', thaiDay)
        .replaceAll('@FULL_DATE@', thaiFullDate).replaceAll('@FULL_DATE', thaiFullDate);

    // 4. Fallback captured screenshot images from db/captured/ if raw @captured_... placeholders are present
    const capturedMap = {
        '@captured_bot_management': 'captured-bot-management.png',
        '@captured_security_level': 'captured-security-level.png',
        '@captured_ssl_overview': 'captured-ssl-overview.png',
        '@captured_ssl_edge': 'captured-ssl-edge.png',
        '@captured_dns_page': 'captured-dns.png',
        '@captured_dns_page_1': 'captured-dns-1.png',
        '@captured_tls_1_3': 'captured-tls-1-3.png',
        '@captured_load_balancing_spectrum': 'captured-load-balancing-spectrum.png',
        '@captured_security_rules_page': 'captured-security-rules.png',
        '@captured_rate_limiting_page': 'captured-rate-limiting.png',
        '@captured_managed_rules_page': 'captured-managed-rules.png',
        '@captured_ip_access_page': 'captured-ip-access.png',
        '@captured_zone_lockdown_page': 'captured-zone-lockdown.png',
        '@captured_traffic_page': 'captured-traffic.png',
        '@captured_request_traffic_page': 'captured-traffic-sub1.png',
        '@captured_data_transfer_traffic_page': 'captured-traffic-sub2.png',
        '@captured_page_views_traffic_page': 'captured-traffic-sub3.png',
        '@captured_visits_traffic_page': 'captured-traffic-sub4.png',
        '@captured_api_requests_traffic_page': 'captured-traffic-sub5.png',
        '@captured_traffic_countries_page': 'captured-traffic-countries.png',
        '@captured_firewall_page': 'captured-firewall.png',
        '@captured_top_events_source_page': 'captured-top-events-source.png',
        '@captured_browser_integrity': 'captured-browser-integrity.png',
        '@captured_min_tls_version': 'captured-min-tls-version.png',
        '@captured_argo_page': 'captured-argo.png',
        '@captured_speed_page': 'captured-speed.png',
        '@captured_speed_mobile_page': 'captured-speed-mobile.png',
        '@captured_domain_page': 'captured-domains.png'
    };

    const capturedDir = path.join(process.cwd(), 'db/captured');
    for (const [tag, imgFileName] of Object.entries(capturedMap)) {
        if (processedHtml.includes(tag)) {
            const imgPath = path.join(capturedDir, imgFileName);
            if (fsSync.existsSync(imgPath)) {
                try {
                    const imgBuffer = fsSync.readFileSync(imgPath);
                    const base64Data = `data:image/png;base64,${imgBuffer.toString('base64')}`;
                    const imgTag = `<div style="text-align: center; margin: 15px 0;"><img src="${base64Data}" alt="${imgFileName}" width="600" style="width: 600px; height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`;
                    processedHtml = processedHtml.replaceAll(tag + '@', imgTag).replaceAll(tag, imgTag);
                } catch (e) {
                    console.warn(`Failed to read fallback captured image ${imgPath}:`, e.message);
                }
            }
        }
    }

    return processedHtml;
}

export async function POST(request) {
    let tempInputPath = null;
    let tempOutputPath = null;

    try {
        const contentType = request.headers.get('content-type') || '';

        let html;
        let filename = 'document.docx';
        let title;
        let margins = null;

        if (contentType.includes('application/json')) {
            const body = await request.json();
            html = body?.html;
            filename = body?.filename || filename;
            title = body?.title;
            margins = body?.margins || null;
        } else {
            // Support form POST to allow browsers to download as a normal file
            // (avoids programmatic download restrictions in some browsers)
            const form = await request.formData();
            html = form.get('html');
            filename = form.get('filename') || filename;
            title = form.get('title');
            const marginsStr = form.get('margins');
            if (marginsStr) {
                try { margins = JSON.parse(marginsStr); } catch (e) {}
            }
        }

        html = typeof html === 'string' ? html : (html ? String(html) : '');
        filename = typeof filename === 'string' ? filename : String(filename);

        // Pre-process HTML content to convert local image URLs into base64 strings so they render in the downloaded Word file
        if (html) {
            // First resolve server-side table of contents and page breaks
            html = processTableOfContentsAndBreaks(html);

            // Clean up any tables nested inside p, span, or div tags, which html-to-docx would discard
            let cleanedHtml = html;
            let previousHtml;
            do {
                previousHtml = cleanedHtml;
                cleanedHtml = cleanedHtml.replace(/<p[^>]*>\s*(<table[\s\S]*?<\/table>)\s*<\/p>/gi, '$1');
                cleanedHtml = cleanedHtml.replace(/<span[^>]*>\s*(<table[\s\S]*?<\/table>)\s*<\/span>/gi, '$1');
                cleanedHtml = cleanedHtml.replace(/<div[^>]*>\s*(<table[\s\S]*?<\/table>)\s*<\/div>/gi, '$1');
            } while (cleanedHtml !== previousHtml);
            
            // Clean up any inline style width on td/th elements to prevent html-to-docx crash
            // We find any <td style="... width: XXX; ..."> and convert it to <td style="..." width="XXX">
            cleanedHtml = cleanedHtml.replace(/(<(?:td|th)\b[^>]*\bstyle=["'])([^"']*?)\bwidth:\s*([^;]+);?\s*([^"']*)(["'])/gi, (match, prefix, styleStart, widthVal, styleEnd, suffix) => {
                const newStyle = (styleStart + styleEnd).trim().replace(/;\s*;/g, ';');
                if (match.includes(' width=')) {
                    return `${prefix}${newStyle}${suffix}`;
                } else {
                    return `${prefix}${newStyle}${suffix} width="${widthVal.trim()}"`;
                }
            });
            
            // Ensure <table> tags are centered and have raw border attributes for LibreOffice compatibility
            cleanedHtml = cleanedHtml.replace(/<table\b([^>]*)>/gi, (tableTag) => {
                let tag = tableTag;
                
                // Add align="center" if not present
                if (!/\balign=/i.test(tag)) {
                    tag = tag.replace('<table', '<table align="center"');
                }
                
                // Add border="1" if not present
                if (!/\bborder=/i.test(tag)) {
                    tag = tag.replace('<table', '<table border="1"');
                }
                
                // Add inline border-collapse if style is present, or add a style attribute
                if (/\bstyle=["']/i.test(tag)) {
                    tag = tag.replace(/\bstyle=["']([^"']*)["']/i, (match, styleContent) => {
                        let newStyle = styleContent;
                        if (!/\bborder-collapse/i.test(newStyle)) {
                            newStyle += '; border-collapse: collapse';
                        }
                        if (!/\bborder\s*:/i.test(newStyle)) {
                            newStyle += '; border: 1px solid #000000';
                        }
                        return `style="${newStyle.trim().replace(/^;+/g, '').replace(/;+/g, ';')}"`;
                    });
                } else {
                    tag = tag.replace('<table', '<table style="border-collapse: collapse; border: 1px solid #000000;"');
                }
                
                return tag;
            });

            // Inline the border styles to all th/td tags to ensure LibreOffice renders all cell borders completely
            cleanedHtml = cleanedHtml.replace(/<(td|th)\b([^>]*)>/gi, (cellTag, tagName, attributes) => {
                let newCellTag = cellTag;
                
                if (/\bstyle=["']/i.test(newCellTag)) {
                    newCellTag = newCellTag.replace(/\bstyle=["']([^"']*)["']/i, (match, styleContent) => {
                        let newStyle = styleContent;
                        if (!/\bborder\s*:/i.test(newStyle)) {
                            newStyle += '; border: 1px solid #000000';
                        }
                        if (!/\bpadding\s*:/i.test(newStyle)) {
                            newStyle += '; padding: 5px';
                        }
                        return `style="${newStyle.trim().replace(/^;+/g, '').replace(/;+/g, ';')}"`;
                    });
                } else {
                    newCellTag = `<${tagName} ${attributes} style="border: 1px solid #000000; padding: 5px;">`;
                }
                
                return newCellTag;
            });

            // Normalize img tags to ensure width/height are in inline style (supported by html-to-docx)
            // and raw attributes (required by LibreOffice to avoid distortion)
            cleanedHtml = cleanedHtml.replace(/<img\b([^>]*)>/gi, (imgTag) => {
                const widthAttrMatch = imgTag.match(/\bwidth=["']?(\d+)(?:px|%)?["']?/i);
                const heightAttrMatch = imgTag.match(/\bheight=["']?(\d+)(?:px|%)?["']?/i);
                
                let width = widthAttrMatch ? widthAttrMatch[1] : null;
                let height = heightAttrMatch ? heightAttrMatch[1] : null;

                const styleAttrMatch = imgTag.match(/\bstyle=["']([^"']*)["']/i);
                let styleContent = styleAttrMatch ? styleAttrMatch[1] : '';

                const styleWidthMatch = styleContent.match(/\bwidth:\s*([^;]+)/i);
                const styleHeightMatch = styleContent.match(/\bheight:\s*([^;]+)/i);

                if (styleWidthMatch) {
                    const wVal = styleWidthMatch[1].trim();
                    const numMatch = wVal.match(/^(\d+)(?:px|%)?$/);
                    if (numMatch) {
                        width = numMatch[1];
                    } else {
                        width = wVal;
                    }
                }
                if (styleHeightMatch) {
                    const hVal = styleHeightMatch[1].trim();
                    const numMatch = hVal.match(/^(\d+)(?:px|%)?$/);
                    if (numMatch) {
                        height = numMatch[1];
                    } else {
                        height = hVal;
                    }
                }

                let cleanedTag = imgTag
                    .replace(/\bstyle=["']([^"']*)["']/gi, '')
                    .replace(/\bwidth=["']?([^"']*)["']?/gi, '')
                    .replace(/\bheight=["']?([^"']*)["']?/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .replace(/\/?>$/, '');

                let newStyles = [];
                let widthAttr = '';
                let heightAttr = '';
                
                if (width !== null) {
                    const widthStr = /^\d+$/.test(width) ? `${width}px` : width;
                    newStyles.push(`width: ${widthStr}`);
                    const rawWidth = String(width).replace('px', '');
                    widthAttr = ` width="${rawWidth}"`;
                }
                if (height !== null) {
                    const heightStr = /^\d+$/.test(height) ? `${height}px` : height;
                    newStyles.push(`height: ${heightStr}`);
                    const rawHeight = String(height).replace('px', '');
                    heightAttr = ` height="${rawHeight}"`;
                }

                if (styleContent) {
                    const parts = styleContent.split(';');
                    parts.forEach(part => {
                        const trimmed = part.trim();
                        if (trimmed && !trimmed.toLowerCase().startsWith('width') && !trimmed.toLowerCase().startsWith('height')) {
                            newStyles.push(trimmed);
                        }
                    });
                }

                const finalStyle = newStyles.join('; ');
                return `${cleanedTag}${widthAttr}${heightAttr} style="${finalStyle}" />`;
            });

            html = cleanedHtml;

            const fsNode = require('fs');
            const pathNode = require('path');
            const publicDir = pathNode.join(process.cwd(), 'public');
            
            console.log("📄 Pre-processing HTML images for Word export...");
            
            const inlineImageSource = async (src) => {
                if (src.startsWith('data:')) {
                    return src;
                }
                
                let decodedSrc = src;
                try {
                    decodedSrc = decodeURIComponent(src);
                } catch (e) {}

                // 1) Relative local paths (e.g. /tinymce/plugins/... or /captured-dashboard.png)
                if (decodedSrc.startsWith('/') && !decodedSrc.startsWith('//')) {
                    const localImgPath = pathNode.join(publicDir, decodedSrc);
                    try {
                        if (fsNode.existsSync(localImgPath)) {
                            const imgBuffer = fsNode.readFileSync(localImgPath);
                            const mimeType = decodedSrc.endsWith('.png') ? 'image/png' : 'image/jpeg';
                            return `data:${mimeType};base64,${imgBuffer.toString('base64')}`;
                        }
                    } catch (err) {
                        console.warn(`Failed to read local relative image: ${localImgPath}`, err.message);
                    }
                }
                
                // 2) Absolute local host URLs or external remote URLs
                if (decodedSrc.startsWith('http://') || decodedSrc.startsWith('https://')) {
                    try {
                        const urlObj = new URL(decodedSrc);
                        // Check if it points to localhost or standard development port
                        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.port === '8002') {
                            const localImgPath = pathNode.join(publicDir, urlObj.pathname);
                            if (fsNode.existsSync(localImgPath)) {
                                const imgBuffer = fsNode.readFileSync(localImgPath);
                                const mimeType = urlObj.pathname.endsWith('.png') ? 'image/png' : 'image/jpeg';
                                return `data:${mimeType};base64,${imgBuffer.toString('base64')}`;
                            }
                        }
                    } catch (e) {}

                    // Fetch remote or external URL with a timeout safety gate
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000);
                        const res = await fetch(decodedSrc, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        
                        if (res.ok) {
                            const arrayBuffer = await res.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);
                            const mime = res.headers.get('content-type') || 'image/jpeg';
                            return `data:${mime};base64,${buffer.toString('base64')}`;
                        }
                    } catch (err) {
                        console.warn(`Failed to fetch remote image: ${decodedSrc}`, err.message);
                    }
                }

                // 3) Fallback: search by basename directly in public folder or db/captured folder (e.g. captured-bot-management.png)
                let imgFile = decodedSrc;
                if (imgFile.includes('?')) imgFile = imgFile.split('?')[0];
                if (imgFile.includes('/')) imgFile = imgFile.substring(imgFile.lastIndexOf('/') + 1);
                
                const fallbackPaths = [
                    pathNode.join(publicDir, imgFile),
                    pathNode.join(process.cwd(), 'db/captured', imgFile)
                ];

                for (const fallbackPath of fallbackPaths) {
                    try {
                        if (fsNode.existsSync(fallbackPath)) {
                            const imgBuffer = fsNode.readFileSync(fallbackPath);
                            const mimeType = imgFile.endsWith('.png') ? 'image/png' : 'image/jpeg';
                            return `data:${mimeType};base64,${imgBuffer.toString('base64')}`;
                        }
                    } catch (e) {}
                }

                return src;
            };

            const imgTagRegex = /<img[^>]+src=["']([^"']+)["']/gi;
            let match;
            let modifiedHtml = html;
            const srcList = new Set();
            
            while ((match = imgTagRegex.exec(html)) !== null) {
                srcList.add(match[1]);
            }
            
            for (const rawSrc of srcList) {
                if (rawSrc.startsWith('data:')) {
                    continue;
                }
                console.log(`🔍 Processing image tag with src: "${rawSrc}"`);
                const dataUri = await inlineImageSource(rawSrc);
                if (dataUri !== rawSrc) {
                    modifiedHtml = modifiedHtml.split(`src="${rawSrc}"`).join(`src="${dataUri}"`);
                    modifiedHtml = modifiedHtml.split(`src='${rawSrc}'`).join(`src='${dataUri}'`);
                    console.log(`   ✅ Inlined successfully: "${rawSrc.substring(0, 60)}..."`);
                }
            }
            // Force clean single TH SarabunPSK font-family on all elements to prevent multi-font comma truncation in MS Word
            const getMarginVal = (val) => {
                if (val === undefined || val === null || val === '') return '2.54cm';
                const num = parseFloat(val);
                return isNaN(num) ? '2.54cm' : `${num}cm`;
            };
            const marginCss = `
                @page {
                    size: 21cm 29.7cm;
                    margin-top: ${getMarginVal(margins?.top)} !important;
                    margin-bottom: ${getMarginVal(margins?.bottom)} !important;
                    margin-left: ${getMarginVal(margins?.left)} !important;
                    margin-right: ${getMarginVal(margins?.right)} !important;
                }
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                }
            `;
            const fontOverrideStyle = `<style>
                * { font-family: 'TH SarabunPSK' !important; }
                h1, h2, h3, h4, h5, h6, p, span, div, table, tr, td, th, a, li, ul, ol {
                    font-family: 'TH SarabunPSK' !important;
                }
                table { width: 100% !important; border-collapse: collapse !important; }
                i, em { font-style: italic !important; }
                b, strong { font-weight: bold !important; }
                ${marginCss}
            </style>`;
            if (modifiedHtml.includes('</head>')) {
                modifiedHtml = modifiedHtml.replace('</head>', `${fontOverrideStyle}</head>`);
            } else {
                modifiedHtml = fontOverrideStyle + modifiedHtml;
            }

            // Ensure all <table> tags have width="100%"
            modifiedHtml = modifiedHtml.replace(/<table(?![^>]*width=["']?100%["']?)([^>]*)>/gi, '<table width="100%"$1>');

            // Convert strong -> b and em -> i so LibreOffice generates direct run formatting (<w:b/> + <w:i/>)
            // instead of conflicting character styles (Strong vs Emphasis) which drops bold when combined with italic
            modifiedHtml = modifiedHtml.replace(/<(\/?)strong\b([^>]*)>/gi, '<$1b$2>');
            modifiedHtml = modifiedHtml.replace(/<(\/?)em\b([^>]*)>/gi, '<$1i$2>');

            // Convert any inline font-size in px to pt (e.g. 22px -> 22pt) so Word receives the exact intended point size
            modifiedHtml = modifiedHtml.replace(/font-size:\s*(\d+(?:\.\d+)?)px/gi, 'font-size: $1pt');

            // Also replace any inline font-family with multiple comma-separated Sarabun fallbacks
            modifiedHtml = modifiedHtml.replace(/font-family:\s*['"][^'"]*Sarabun[^'"]*['"]/gi, "font-family: 'TH SarabunPSK'");
            modifiedHtml = modifiedHtml.replace(/font-family:\s*[^;"]*Sarabun[^;"]*/gi, "font-family: 'TH SarabunPSK'");

            html = modifiedHtml;
        }

        if (!html) {
            return NextResponse.json({ success: false, message: 'Missing HTML content' }, { status: 400 });
        }

        // --- Security: Prevent HTTP Header Injection ---
        const safeFileName = path.basename(filename).replace(/[^a-zA-Z0-9_\\-\\.]/g, '');
        const finalFileName = safeFileName || 'document.docx';

        let docxBuffer = null;

        // 1) First try LibreOffice CLI. It has highest formatting/layout fidelity (respects line-height, margins, page breaks, etc.)
        const tmpDir = path.join(os.tmpdir(), 'WordConversion');
        await fs.mkdir(tmpDir, { recursive: true });

        const timestamp = Date.now();
        const safeBaseName = `api_report_${timestamp}`;
        const inputPath = path.join(tmpDir, `${safeBaseName}.html`);
        const outputPath = path.join(tmpDir, `${safeBaseName}.docx`);
        tempInputPath = inputPath;
        tempOutputPath = outputPath;

        try {
            console.log(`🔄 Writing temporary HTML for LibreOffice: ${inputPath}`);
            await fs.writeFile(inputPath, html, 'utf-8');

            const command = `soffice --headless --infilter="HTML Document" --convert-to "docx:MS Word 2007 XML" --outdir "${tmpDir}" "${inputPath}"`;
            console.log(`LibreOffice Command: ${command}`);

            const { stderr } = await execAsync(command, { env: { ...process.env, HOME: '/tmp' } });
            if (stderr) console.warn(`LibreOffice Stderr: ${stderr}`);

            await fs.access(outputPath);
            docxBuffer = await fs.readFile(outputPath);
            console.log('🔄 Conversion successful using LibreOffice CLI.');
        } catch (loError) {
            console.warn('LibreOffice CLI conversion failed or not available, falling back to html-to-docx:', loError?.message || loError);
            docxBuffer = null;
        }

        // 2) Fallback to html-to-docx if LibreOffice is not available
        if (!docxBuffer) {
            try {
                console.log('🔄 Converting to DOCX using html-to-docx...');
                // html-to-docx returns a Buffer/Uint8Array
                docxBuffer = await HTMLtoDOCX(String(html), null, {
                    font: 'TH SarabunPSK',
                    fontSize: 32
                });
            } catch (e) {
                console.error('html-to-docx conversion failed:', e?.message || e);
                throw e;
            }
        }

        // Sanitize all font references in the generated docx archive
        if (docxBuffer) {
            docxBuffer = await sanitizeDocxFonts(docxBuffer, margins);
        }

        console.log(`✅ API Conversion successful. Buffer length: ${docxBuffer.length}`);

        // 5. Return the new DOCX
        return new Response(docxBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${finalFileName}"`,
                'Content-Length': docxBuffer.length.toString(),
            },
        });

    } catch (error) {
        console.error('DOCX Export/Conversion Error:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to convert to DOCX. Make sure LibreOffice is installed and available to the server runtime.',
            error: error.message
        }, { status: 500 });
    } finally {
        // Cleanup temp files safely
        if (tempInputPath) {
            try { await fs.unlink(tempInputPath); } catch (e) { }
        }
        if (tempOutputPath) {
            try { await fs.unlink(tempOutputPath); } catch (e) { }
        }
    }
}
