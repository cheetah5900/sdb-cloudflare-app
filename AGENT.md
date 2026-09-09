# Project Overview

This is a Next.js application that provides a comprehensive dashboard and automated report generation platform for Cloudflare. It allows users to view and manage Cloudflare zones, DNS records, traffic analytics, security monitoring, and execute automated report generation systems (GDCC & NTBC).

The frontend is built with React and Tailwind CSS, and the backend is powered by Next.js API Routes and Server Actions. It uses `puppeteer` (connecting to a dedicated headless Chromium container via CDP), `axios` for Cloudflare API communication, `sharp` for image processing, `swift` + Apple Vision Framework for high-accuracy native OCR verification, and `sqlite` for user database management.

# Features

*   **Zone & DNS Management:** View and manage Cloudflare zones and DNS records.
*   **Traffic Analytics:** Real-time visualization of traffic volume, top URLs, client IPs, and countries using Recharts.
*   **Security Monitoring:** Track WAF events, blocked attacks, and HTTP status code distributions.
*   **API Discovery:** Discover and manage API endpoints associated with your zones with graceful degradation.
*   **GDCC Batch Reporting:** Automatically generate comprehensive reports for multiple sub-domains with template variables (e.g., `@TOP_HOST_VAL@`), domain template promotion, and Word export.
*   **NTBC Cloudflare Automated Report Generator (`/systems/ntbc_cfreport`):** Automated full-report generator for NTBC domains with template customization, dynamic data binding, and DOCX export.
*   **Template Variable Screenshot Live Preview:**
    *   **Live Preview Button (`👁️ ตัวอย่าง`):** Integrated into the template editor variable sidebar for all screenshot variables (`@captured_*`).
    *   **High-Resolution Preview Modal:** Displays the latest captured screenshot from the system with variable tag badge, description, and direct "แทรกลงในเทมเพลต" insertion.
    *   **Top-Right Toast Notifications:** Automatic SweetAlert2 warning toast (`ntbc-top-toast`) when previewing variables that have not been captured yet.
*   **NTBC Interactive Control Panel (`/systems/ntbc_cfreport/control`):**
    *   **Live Browser Monitor (noVNC):** Embedded real-time VNC monitor connected to the remote Chromium browser (`sdb-chrome-browser:9222`).
    *   **Smart Element Screenshotting Engine (`/api/ntbc-capture`):**
        *   **Dedicated Granular Captures:** Dedicated DOM resolution and capture routines for `min-tls-version`, `tls-1-3`, `browser-integrity-check`, and `load-balancing-spectrum` (with `IF Enable` support).
        *   **Exact Card Box Clip:** Automatically resolves DOM bounding boxes for cards (`Bot Management`, `Security Level`, `Minimum TLS Version`, `TLS 1.3`, `Browser Integrity Check`) with 4-corner rounded border wrapping.
        *   **Dynamic Content & Table Height:** Calculates dynamic height from section headings to the bottom of live data tables (DNS, Security Rules, WAF, Rate Limiting, Zone Lockdown, IP Access Rules, Load Balancing).
        *   **Search Box Pre-filtering:** Automatically searches settings (e.g. typing `"Security Level"` into settings search) before capturing to ensure hidden/deeply-scrolled elements render.
        *   **Universal Relative Offset System:** Standardized 4-directional relative offsets (`Xstart`, `Xend`, `Ystart`, `Yend`) across all capture tabs with default `0` (`Auto (+0)`).
        *   **Dark-Theme Fallback Generator:** Generates branded fallback SVG images when features are unavailable for specific accounts/zones.
*   **Native Apple Vision OCR Verification Engine:**
    *   Built-in macOS Vision framework OCR test suite for verifying text accuracy and keyword presence across all screenshot captures.
*   **Dynamic Theming:** Centralized theme management supporting Dark, Pink Pastel, and Corporate Blue themes via `app/utils/themes.js`.
*   **Robust API Security:** Strict token/UUID validation and path traversal protections.

# Building and Running

1.  **Docker Compose (Recommended):**
    ```bash
    docker compose up -d --build
    ```
    *   Web App: `http://localhost:8002`
    *   Chrome Debugger: `http://localhost:9222`
    *   noVNC Monitor: `http://localhost:6080/vnc.html`

2.  **Install dependencies locally:**
    ```bash
    npm install
    ```

3.  **Run development server:**
    ```bash
    npm run dev
    ```

4.  **Production build inside container:**
    ```bash
    docker compose build app && docker compose up -d app
    ```

# Development Conventions

*   **Styling & Theming:**
    *   Tailwind CSS for styling.
    *   All colors centralized in `app/utils/themes.js`.
    *   Do not hardcode colors in GDCC/global components; use `theme` tokens.
*   **Screenshot & Automation Constraints:**
    *   Remote Chrome browser runs in the `sdb-chrome-browser` container.
    *   Puppeteer connects via CDP WebSocket (`http://sdb-chrome-browser:9222/json/version`).
    *   All coordinate crop inputs must operate as relative offsets from auto-detected DOM anchors (default `0`).
    *   Always use `escapeXml()` for text injected into SVG templates in `generateUnavailableImage()` to avoid XML parsing corruption.
*   **Module-Specific Testing & OCR:**
    *   Run tests individually per module or verify template variables using native Apple Vision OCR scripts (e.g. `node tests/verify-gls-template-captures-with-ocr.mjs`).

# Key Files

*   `app/page.js`: Portal homepage with navigation to all systems.
*   `app/systems/ntbc_cfreport/page.js`: NTBC Cloudflare report generator interface and ReportModal editor with screenshot preview modal.
*   `app/systems/ntbc_cfreport/control/page.js`: NTBC interactive control panel with live noVNC monitor, coordinate editor, and dedicated capture tabs.
*   `app/systems/ntbc_cfreport/variableDefinitions.js`: Centralized variable dictionary for report templates, dynamic categories, and screenshot mappings.
*   `app/systems/ntbc_cfreport/utils/alert.js`: SweetAlert2 custom toast and popup helper configuration.
*   `app/api/ntbc-capture/route.js`: Multi-tab Puppeteer screenshot capture engine with dynamic bounding, search pre-filtering, and fallback generator.
*   `app/api/ntbc-capture-coords/route.js`: API endpoint for reading and persisting coordinate offsets.
*   `app/data/capture_coords.json`: Centralized coordinate offset storage file.
*   `app/systems/gdcc/page.js`: GDCC Analytics and Batch Report generator.
*   `app/systems/Sidebar.js`: Global sidebar navigation component.
*   `app/utils/themes.js`: Global theme tokens configuration.

# Recent Changes (September 2026)

*   **Screenshot Variable Live Preview in Template Editor:** Added `👁️ ตัวอย่าง` (Preview) buttons to all `@captured_*` variables in the ReportModal sidebar. Clicking opens a modal showing the latest captured screenshot from disk, or triggers a top-right warning toast if no screenshot exists.
*   **Granular SSL/TLS & DNS Capture Endpoints:** Added dedicated capture endpoints and variables for `Minimum TLS Version` (`@captured_min_tls_version`), `TLS 1.3` (`@captured_tls_1_3`), `Browser Integrity Check` (`@captured_browser_integrity`), and `Load Balancing & Spectrum` (`@captured_load_balancing_spectrum`).
*   **Control Panel Tab Consolidation:** Removed redundant `Edge Certificates` tab from the control panel in favor of dedicated `SSL/TLS Mode` (🔒), `Min TLS Version` (🔒), and `TLS 1.3` (⚡).
*   **Native Apple Vision OCR Verification:** Implemented native macOS Vision framework OCR testing suite to verify that captured screenshots contain expected keywords and layout text.
*   **Universal Relative Offset Coordinate Architecture:** Converted all 4 coordinate fields (`Xstart`, `Xend`, `Ystart`, `Yend`) across all tabs into relative offsets from auto-detected DOM anchors. Defaulted all coordinate inputs and saved storage to `0`.
*   **Smart Security Level Card Detection & Search Pre-filtering:** Automated search filtering in Cloudflare settings (`input[name="settings-search"]`) to reveal the `Security Level` card before computing the exact card bounding box and capturing.
*   **Multi-mode Bot Management Detection:** Implemented 3-mode hierarchical search (`Super Bot Fight Mode`, `Bot Fight Mode`, `Bot Management`) with exact card bounding.
