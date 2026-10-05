// Canonical list of "@uploaded_*" template variable slots: one per existing "@captured_*"
// screenshot variable (see variableDefinitions.js). Each slot lets the user manually upload
// their own image as an override/replacement for a section — useful when they want to supply
// a screenshot themselves, or when Cloudflare's dashboard UI changes and the automated
// Puppeteer capture breaks, so they don't have to wait on a code fix to get a report out.
//
// `id` matches the id used by the existing GET /api/ntbc-capture?action=get-saved response
// (the `screenshots` map) and is also the key used for the new `uploaded` map in that same
// response, and for the POST save-uploaded/delete-uploaded actions on that same route.
// `stateKey` is the page.js React state variable name convention: `uploaded<Id>Image`.
// `varName` is the literal "@uploaded_*" template placeholder text.
export const UPLOADED_SLOTS = [
    { id: 'domains', varName: '@uploaded_domain_page', label: 'Domains (Sites overview)' },
    { id: 'dns', varName: '@uploaded_dns_page', label: 'DNS Records' },
    { id: 'traffic', varName: '@uploaded_traffic_page', label: 'HTTP Traffic (หน้ารวม)' },
    { id: 'trafficSub1', varName: '@uploaded_request_traffic_page', label: 'HTTP Traffic — Requests' },
    { id: 'trafficSub2', varName: '@uploaded_data_transfer_traffic_page', label: 'HTTP Traffic — Data Transfer' },
    { id: 'trafficSub3', varName: '@uploaded_page_views_traffic_page', label: 'HTTP Traffic — Page Views' },
    { id: 'trafficSub4', varName: '@uploaded_visits_traffic_page', label: 'HTTP Traffic — Visits' },
    { id: 'trafficSub5', varName: '@uploaded_api_requests_traffic_page', label: 'HTTP Traffic — API Requests' },
    { id: 'trafficCountries', varName: '@uploaded_traffic_countries_page', label: 'Traffic by Country' },
    { id: 'firewall', varName: '@uploaded_firewall_page', label: 'Firewall Overview' },
    { id: 'topEventsSource', varName: '@uploaded_top_events_source_page', label: 'Top Events by Source' },
    { id: 'securityRules', varName: '@uploaded_security_rules_page', label: 'Security Custom Rules' },
    { id: 'rateLimiting', varName: '@uploaded_rate_limiting_page', label: 'Rate Limiting Rules' },
    { id: 'managedRules', varName: '@uploaded_managed_rules_page', label: 'Managed WAF Rules' },
    { id: 'ipAccess', varName: '@uploaded_ip_access_page', label: 'IP Access Rules' },
    { id: 'zoneLockdown', varName: '@uploaded_zone_lockdown_page', label: 'Zone Lockdown Rules' },
    { id: 'argo', varName: '@uploaded_argo_page', label: 'Argo Smart Routing' },
    { id: 'speed', varName: '@uploaded_speed_page', label: 'Speed Test (Desktop)' },
    { id: 'speedMobile', varName: '@uploaded_speed_mobile_page', label: 'Speed Test (Mobile)' },
    { id: 'botManagement', varName: '@uploaded_bot_management', label: 'Bot Management' },
    { id: 'securityLevel', varName: '@uploaded_security_level', label: 'Security Level & BIC' },
    { id: 'sslOverview', varName: '@uploaded_ssl_overview', label: 'SSL/TLS Encryption Mode' },
    { id: 'sslEdge', varName: '@uploaded_ssl_edge', label: 'Minimum TLS Version & TLS 1.3 (รวม)' },
    { id: 'minTlsVersion', varName: '@uploaded_min_tls_version', label: 'Minimum TLS Version' },
    { id: 'tls13', varName: '@uploaded_tls_1_3', label: 'TLS 1.3' },
    { id: 'browserIntegrity', varName: '@uploaded_browser_integrity', label: 'Browser Integrity Check' },
    { id: 'loadBalancingSpectrum', varName: '@uploaded_load_balancing_spectrum', label: 'Load Balancing and Spectrum' },
];

// id -> "uploaded-<slug>.png" filename used on disk under db/captured/ (mirrors the existing
// "captured-<slug>.png" naming, just swapping the prefix). Kept here so the frontend and the
// API route agree on the same slugs without duplicating the list.
export const UPLOADED_SLUGS = {
    domains: 'domains',
    dns: 'dns',
    traffic: 'traffic',
    trafficSub1: 'traffic-sub1',
    trafficSub2: 'traffic-sub2',
    trafficSub3: 'traffic-sub3',
    trafficSub4: 'traffic-sub4',
    trafficSub5: 'traffic-sub5',
    trafficCountries: 'traffic-countries',
    firewall: 'firewall',
    topEventsSource: 'top-events-source',
    securityRules: 'security-rules',
    rateLimiting: 'rate-limiting',
    managedRules: 'managed-rules',
    ipAccess: 'ip-access',
    zoneLockdown: 'zone-lockdown',
    argo: 'argo',
    speed: 'speed',
    speedMobile: 'speed-mobile',
    botManagement: 'bot-management',
    securityLevel: 'security-level',
    sslOverview: 'ssl-overview',
    sslEdge: 'ssl-edge',
    minTlsVersion: 'min-tls-version',
    tls13: 'tls-1-3',
    browserIntegrity: 'browser-integrity',
    loadBalancingSpectrum: 'load-balancing-spectrum',
};
