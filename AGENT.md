# Project Overview

This is a Next.js application that provides a comprehensive dashboard and automated report generation platform for Cloudflare. It allows users to view and manage Cloudflare zones, DNS records, traffic analytics, security monitoring, and execute automated report generation systems (GDCC & NTBC).

The frontend is built with React and Tailwind CSS, and the backend is powered by Next.js API Routes and Server Actions. It uses `puppeteer` (connecting to a dedicated headless Chromium container via CDP), `axios` for Cloudflare API communication, `sharp` for image processing, and `sqlite` for user database management.

# Features

*   **Zone & DNS Management:** View and manage Cloudflare zones and DNS records.
*   **Traffic Analytics:** Real-time visualization of traffic volume, top URLs, client IPs, and countries using Recharts.
*   **Security Monitoring:** Track WAF events, blocked attacks, and HTTP status code distributions.
*   **API Discovery:** Discover and manage API endpoints associated with your zones with graceful degradation.
*   **GDCC Batch Reporting:** Automatically generate comprehensive reports for multiple sub-domains with template variables (e.g., `@TOP_HOST_VAL@`), domain template promotion, and Word export.
*   **NTBC Cloudflare Automated Report Generator (`/systems/ntbc_cfreport`):** Automated full-report generator for NTBC domains with template customization, dynamic data binding, and DOCX export.
*   **NTBC Interactive Control Panel (`/systems/ntbc_cfreport/control`):**
    *   **Live Browser Monitor (noVNC):** Embedded real-time VNC monitor connected to the remote Chromium browser (`sdb-chrome-browser:9222`).
    *   **Smart Element Screenshotting Engine (`/api/ntbc-capture`):**
        *   **Exact Card Box Clip:** Automatically resolves DOM bounding boxes for cards (`Bot Management`, `Security Level`) with 4-corner rounded border wrapping.
        *   **Dynamic Content & Table Height:** Calculates dynamic height from section headings to the bottom of live data tables (DNS, Security Rules, WAF, Rate Limiting, Zone Lockdown, IP Access Rules).
        *   **Search Box Pre-filtering:** Automatically searches settings (e.g. typing `"Security Level"` into settings search) before capturing to ensure hidden/deeply-scrolled elements render.
        *   **Universal Relative Offset System:** Standardized 4-directional relative offsets (`Xstart`, `Xend`, `Ystart`, `Yend`) across all 18 tabs with default `0` (`Auto (+0)`).
        *   **Dark-Theme Fallback Generator:** Generates branded fallback SVG images when features are unavailable for specific accounts/zones.
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
    docker exec sdb-cloudflare-app npm run build
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
*   **Module-Specific Testing:**
    *   Run tests individually per module (e.g. `node tests/unit-test-security-level-capture.mjs`).

# Key Files

*   `app/page.js`: Portal homepage with navigation to all systems.
*   `app/systems/ntbc_cfreport/page.js`: NTBC Cloudflare report generator interface.
*   `app/systems/ntbc_cfreport/control/page.js`: NTBC interactive control panel with live noVNC monitor and coordinate editor.
*   `app/api/ntbc-capture/route.js`: Multi-tab Puppeteer screenshot capture engine with dynamic bounding and fallback generator.
*   `app/api/ntbc-capture-coords/route.js`: API endpoint for reading and persisting coordinate offsets.
*   `app/data/capture_coords.json`: Centralized coordinate offset storage file.
*   `app/systems/gdcc/page.js`: GDCC Analytics and Batch Report generator.
*   `app/systems/Sidebar.js`: Global sidebar navigation component.
*   `app/utils/themes.js`: Global theme tokens configuration.

# Recent Changes (September 2026)

*   **Universal Relative Offset Coordinate Architecture:** Converted all 4 coordinate fields (`Xstart`, `Xend`, `Ystart`, `Yend`) across all 18 tabs into relative offsets from auto-detected DOM anchors. Defaulted all coordinate inputs and saved storage to `0`.
*   **Smart Security Level Card Detection & Search Pre-filtering:** Automated search filtering in Cloudflare settings (`input[name="settings-search"]`) to reveal the `Security Level` card before computing the exact card bounding box and capturing.
*   **Multi-mode Bot Management Detection:** Implemented 3-mode hierarchical search (`Super Bot Fight Mode`, `Bot Fight Mode`, `Bot Management`) with exact card bounding.
*   **SVG Fallback Generator XML Sanitization:** Added `escapeXml()` sanitization for SVG titles and descriptions to prevent XML header parsing errors during fallback image creation.
*   **Live Monitor UI Cleanup:** Streamlined the Live Browser Monitor card header on the control page.
