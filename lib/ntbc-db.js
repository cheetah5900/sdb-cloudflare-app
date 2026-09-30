import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db = null;

export const getNtbcDb = async () => {
    if (db) return db;

    try {
        const dbDir = path.resolve(process.cwd(), 'db');
        if (!fs.existsSync(dbDir)) {
            console.log(`📂 Creating database directory at: ${dbDir}`);
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const dbPath = path.join(dbDir, 'ntbc_jobs.db');
        console.log(`📂 Connecting to NTBC Jobs database at: ${dbPath}`);

        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        await db.exec('PRAGMA journal_mode = WAL');
        await db.exec('PRAGMA synchronous = NORMAL');
        console.log(`✅ NTBC Jobs Database connected (WAL mode): ${dbPath}`);

        await db.exec(`
        CREATE TABLE IF NOT EXISTS ntbc_report_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          account_id TEXT NOT NULL,
          account_name TEXT,
          zone_id TEXT NOT NULL,
          zone_name TEXT NOT NULL,
          subdomains TEXT NOT NULL,
          start_date DATE,
          end_date DATE,
          template_id TEXT DEFAULT 'default',
          export_thai_digits INTEGER DEFAULT 0,
          user_session TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          progress INTEGER DEFAULT 0,
          status_message TEXT,
          file_name TEXT,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

        // Migration: add user_session to pre-existing DBs from before this column existed.
        // Needed so a job queued while another is still processing can be auto-chained by
        // the worker (see getNextPendingNtbcJob()) without a live browser tab to re-supply it.
        try {
            const columns = await db.all(`PRAGMA table_info(ntbc_report_jobs)`);
            const hasUserSession = columns.some(c => c.name === 'user_session');
            if (!hasUserSession) {
                console.log('🔧 Migrating ntbc_report_jobs: adding user_session column...');
                await db.exec(`ALTER TABLE ntbc_report_jobs ADD COLUMN user_session TEXT`);
            }
        } catch (migrationErr) {
            console.error('❌ NTBC Jobs DB migration error:', migrationErr);
        }

        return db;
    } catch (error) {
        console.error('❌ Database Error (NTBC Jobs):', error);
        throw error;
    }
};

// --- NTBC Background Report Jobs Helpers ---

export const createNtbcReportJob = async (userId, accountId, accountName, zoneId, zoneName, subdomains, startDate, endDate, templateId = 'default', exportThaiDigits = false, userSession = null) => {
    const database = await getNtbcDb();
    const query = `
        INSERT INTO ntbc_report_jobs (user_id, account_id, account_name, zone_id, zone_name, subdomains, start_date, end_date, template_id, export_thai_digits, user_session, status, progress, status_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 'Queued')
    `;
    const result = await database.run(query, [
        userId,
        accountId,
        accountName,
        zoneId,
        zoneName,
        JSON.stringify(subdomains),
        startDate || null,
        endDate || null,
        templateId,
        exportThaiDigits ? 1 : 0,
        userSession ? JSON.stringify(userSession) : null
    ]);
    const newJobId = result.lastID;

    // Cleanup old jobs exceeding 10 limit for this user
    try {
        const userJobs = await database.all(
            `SELECT id, file_name FROM ntbc_report_jobs WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );
        if (userJobs.length > 10) {
            const jobsToDelete = userJobs.slice(10);
            for (const jobToDelete of jobsToDelete) {
                await database.run(`DELETE FROM ntbc_report_jobs WHERE id = ?`, [jobToDelete.id]);
                if (jobToDelete.file_name) {
                    const reportsDir = path.join(process.cwd(), 'public', 'reports');
                    const filePath = path.join(reportsDir, jobToDelete.file_name);
                    if (fs.existsSync(filePath)) {
                        try {
                            fs.unlinkSync(filePath);
                            console.log(`🗑️ Auto-deleted old NTBC report file: ${jobToDelete.file_name}`);
                        } catch (fileErr) {
                            console.error(`❌ Failed to delete old NTBC report file: ${jobToDelete.file_name}`, fileErr);
                        }
                    }
                }
            }
        }
    } catch (cleanupErr) {
        console.error('❌ Error during NTBC report job cleanup:', cleanupErr);
    }

    return newJobId;
};

export const updateNtbcReportJobProgress = async (id, progress, status, statusMessage = null, fileName = null, errorMessage = null) => {
    const database = await getNtbcDb();
    const query = `
        UPDATE ntbc_report_jobs
        SET progress = ?, status = ?, status_message = ?, file_name = COALESCE(?, file_name), error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    await database.run(query, [progress, status, statusMessage, fileName, errorMessage, id]);
};

export const getNtbcReportJobs = async (userId = null) => {
    const database = await getNtbcDb();
    if (userId) {
        return await database.all(`SELECT * FROM ntbc_report_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [userId]);
    }
    return await database.all(`SELECT * FROM ntbc_report_jobs ORDER BY created_at DESC LIMIT 20`);
};

export const getNtbcReportJobById = async (id) => {
    const database = await getNtbcDb();
    return await database.get(`SELECT * FROM ntbc_report_jobs WHERE id = ?`, [id]);
};

export const deleteNtbcReportJob = async (id) => {
    const database = await getNtbcDb();
    await database.run(`DELETE FROM ntbc_report_jobs WHERE id = ?`, [id]);
};

// Returns the oldest job still queued (pending), or null if none.
export const getNextPendingNtbcJob = async () => {
    const database = await getNtbcDb();
    return await database.get(`SELECT * FROM ntbc_report_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`);
};

// True if any job is currently mid-run (used to block manual/live capture from colliding on the shared debug browser tab).
export const hasActiveNtbcJob = async () => {
    const database = await getNtbcDb();
    const row = await database.get(`SELECT id FROM ntbc_report_jobs WHERE status = 'processing' LIMIT 1`);
    return !!row;
};
