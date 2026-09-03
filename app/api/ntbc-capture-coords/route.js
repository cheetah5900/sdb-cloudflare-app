import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const filePath = path.join(process.cwd(), 'app', 'data', 'capture_coords.json');

export const dynamic = 'force-dynamic';

const DEFAULT_COORDS = {
    domains: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    dns: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    traffic: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    firewall: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    securityRules: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    argo: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    speed: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    speedMobile: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    botManagement: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    securityLevel: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    sslOverview: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    sslEdge: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    rateLimiting: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    managedRules: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    ipAccess: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    zoneLockdown: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    trafficCountries: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
    topEventsSource: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' }
};

export async function GET() {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return NextResponse.json(JSON.parse(data));
        }
        return NextResponse.json(DEFAULT_COORDS);
    } catch (e) {
        console.error('Error reading capture_coords.json:', e);
        return NextResponse.json(DEFAULT_COORDS);
    }
}

export async function POST(req) {
    try {
        const coords = await req.json();
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(coords, null, 2), 'utf8');
        return NextResponse.json({ success: true, message: 'Coordinates saved successfully to central database.' });
    } catch (e) {
        console.error('Error writing capture_coords.json:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
