import { NextResponse } from 'next/server';
import { createNtbcReportJob, getNtbcReportJobs, getNtbcReportJobById, deleteNtbcReportJob, hasActiveNtbcJob } from '@/lib/ntbc-db';
import { runBackgroundNtbcReportJob } from '@/lib/ntbc-report-worker';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const id = searchParams.get('id');
        const userId = searchParams.get('userId');

        if (action === 'download') {
            const fileName = searchParams.get('fileName');
            if (!fileName) {
                return NextResponse.json({ success: false, message: 'Missing fileName' }, { status: 400 });
            }

            const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9_\\-\\.]/g, '');
            if (!safeFileName) {
                return NextResponse.json({ success: false, message: 'Invalid fileName' }, { status: 400 });
            }

            const filePath = path.join(process.cwd(), 'public', 'reports', safeFileName);
            if (!fs.existsSync(filePath)) {
                return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
            }

            const fileBuffer = fs.readFileSync(filePath);
            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Disposition': `attachment; filename="${safeFileName}"`,
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                }
            });
        }

        if (action === 'delete') {
            if (!id) {
                return NextResponse.json({ success: false, message: 'Missing ID' }, { status: 400 });
            }

            const job = await getNtbcReportJobById(id);
            if (job && job.file_name) {
                try {
                    const safeFileName = path.basename(job.file_name).replace(/[^a-zA-Z0-9_\\-\\.]/g, '');
                    if (safeFileName) {
                        const filePath = path.join(process.cwd(), 'public', 'reports', safeFileName);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            console.log(`🗑️ Deleted background NTBC report file: ${safeFileName}`);
                        }
                    }
                } catch (err) {
                    console.error('Failed to delete background NTBC report file:', err.message);
                }
            }

            await deleteNtbcReportJob(id);
            return NextResponse.json({ success: true, message: 'Job deleted successfully' });
        }

        if (action === 'has-active') {
            const active = await hasActiveNtbcJob();
            return NextResponse.json({ success: true, active });
        }

        const jobs = await getNtbcReportJobs(userId);
        return NextResponse.json({ success: true, data: jobs });
    } catch (error) {
        console.error('API Error:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            userId,
            accountId,
            accountName,
            zoneId,
            zoneName,
            subdomains,
            startDate,
            endDate,
            templateId,
            exportThaiDigits,
            userSession
        } = body;

        if (!accountId || !zoneId || !subdomains || !userSession) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const jobId = await createNtbcReportJob(
            userId,
            accountId,
            accountName,
            zoneId,
            zoneName,
            subdomains,
            startDate,
            endDate,
            templateId || 'default',
            exportThaiDigits || false,
            userSession
        );

        // Serial-queue: NTBC captures share ONE authenticated debug browser tab, so only one
        // job may run at a time. If another job is already processing, this one just sits as
        // 'pending' — the worker auto-chains to the next pending job (using the user_session
        // stored with it) as soon as the current one finishes. Otherwise, start it now.
        const alreadyActive = await hasActiveNtbcJob();
        if (!alreadyActive) {
            const protocol = request.headers.get('x-forwarded-proto') || 'http';
            const host = request.headers.get('host');
            const baseUrl = `${protocol}://${host}`;

            runBackgroundNtbcReportJob(jobId, baseUrl, userSession).catch(err => {
                console.error(`❌ NTBC background job ${jobId} failed:`, err.message);
            });
        }

        return NextResponse.json({
            success: true,
            message: alreadyActive
                ? 'Queued behind the currently processing NTBC job.'
                : 'Background NTBC report generation started.',
            data: { jobId, queuedBehindActive: alreadyActive }
        });
    } catch (error) {
        console.error('API Error:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
