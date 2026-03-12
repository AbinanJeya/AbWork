/**
 * CSV Workout History Import – Universal Parser
 *
 * Dynamically detects columns from any workout CSV export (Hevy, Strong, etc).
 * Handles missing columns gracefully — only Date and Exercise Name are truly required.
 *
 * Column detection strategy:
 *   1. Read the header row
 *   2. Build a flexible map of which columns exist by scanning for keyword matches
 *   3. Use whatever data is available, fall back for anything missing
 */

import { searchExercises } from './exerciseDB';
import { getSettings } from './storage';

const API_URL = 'https://api.openai.com/v1/chat/completions';

// ── CSV Parsing ──────────────────────────────────────────
function parseCSVLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',' || ch === ';' || ch === '\t') {
                cells.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    cells.push(current.trim());
    return cells;
}

function parseCSV(text) {
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    const rawHeaders = parseCSVLine(lines[0]);
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i]);
        if (cells.length < 2) continue;
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = cells[idx] || ''; });
        rows.push(obj);
    }
    return { headers, rows };
}

// ── Dynamic Column Detection ─────────────────────────────
// Each field has an array of keyword patterns to look for in headers.
// The first matching header wins.
const COLUMN_PATTERNS = {
    date: ['start_time', 'date', 'time', 'timestamp', 'when', 'day', 'performed'],
    workoutName: ['title', 'workout name', 'routine name', 'session name', 'routine', 'workout title'],
    exerciseName: ['exercise_title', 'exercise name', 'exercise', 'movement', 'lift'],
    setOrder: ['set_index', 'set order', 'set number', 'set no', 'set #', 'set'],
    weight: ['weight'],
    weightUnit: ['weight unit', 'unit'],
    reps: ['reps', 'repetitions', 'rep'],
    rpe: ['rpe', 'rate of perceived'],
    distance: ['distance_km', 'distance'],
    distanceUnit: ['distance unit'],
    seconds: ['duration_seconds', 'seconds', 'time under tension'],
    notes: ['notes', 'note', 'comment', 'exercise_notes'],
    workoutNotes: ['workout notes', 'session notes', 'description'],
    duration: ['workout duration', 'duration', 'total time', 'elapsed'],
    endTime: ['end_time', 'end time', 'endtime', 'finished', 'stop time'],
};

function buildColumnMap(headers) {
    const map = {};
    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
        map[field] = null;
        for (const pattern of patterns) {
            const match = headers.find(h => h.includes(pattern));
            if (match) {
                map[field] = match;
                break;
            }
        }
    }
    return map;
}

function getField(row, colMap, field) {
    if (!colMap[field]) return '';
    return row[colMap[field]] || '';
}

function parseDuration(val) {
    if (!val) return 0;
    // "1h 23m 45s" format
    const hmsMatch = val.match(/(\d+)h\s*(\d+)m/i);
    if (hmsMatch) return parseInt(hmsMatch[1]) * 3600 + parseInt(hmsMatch[2]) * 60;
    // "01:23:45" format
    const colonMatch = val.match(/(\d+):(\d+):(\d+)/);
    if (colonMatch) return parseInt(colonMatch[1]) * 3600 + parseInt(colonMatch[2]) * 60 + parseInt(colonMatch[3]);
    // "83:45" (mm:ss)
    const mmss = val.match(/^(\d+):(\d+)$/);
    if (mmss) return parseInt(mmss[1]) * 60 + parseInt(mmss[2]);
    // Plain number (seconds)
    const num = parseInt(val);
    return isNaN(num) ? 0 : num;
}

// ── Exercise Name Matching ───────────────────────────────
const nameCache = new Map();

function stripEquipmentHints(name) {
    return name
        .replace(/\s*\((?:barbell|dumbbell|machine|cable|smith|ez.bar|band|kettlebell|bodyweight|plate|trap bar|landmine|lever|hammer|neutral grip|close grip|wide grip|reverse grip|single arm|single leg|seated|standing|incline|decline|flat|overhead|front|rear|lateral|pronated|supinated)\)/gi, '')
        .trim();
}

async function matchViaExerciseDB(rawName) {
    const stripped = stripEquipmentHints(rawName);
    try {
        const results = await searchExercises(stripped, 3);
        if (results && results.length > 0) {
            const lower = stripped.toLowerCase();
            const exact = results.find(r => r.name.toLowerCase() === lower);
            return exact ? exact.name : results[0].name;
        }
    } catch (e) {
        console.warn('ExerciseDB match failed:', e);
    }
    return null;
}

async function matchViaAI(rawName) {
    try {
        const settings = await getSettings();
        if (!settings.openAIKey) return null;

        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${settings.openAIKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a fitness exercise name resolver. Given a potentially non-standard exercise name, return the most common, universally recognized name. Reply with ONLY the exercise name, nothing else.',
                    },
                    {
                        role: 'user',
                        content: `Resolve this exercise name to its standard form: "${rawName}"`,
                    },
                ],
                max_tokens: 30,
                temperature: 0,
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const resolved = data.choices?.[0]?.message?.content?.trim();
        return resolved || null;
    } catch (e) {
        console.warn('AI exercise match failed:', e);
        return null;
    }
}

async function resolveExerciseName(rawName) {
    if (!rawName) return rawName;
    const key = rawName.toLowerCase().trim();
    if (nameCache.has(key)) return nameCache.get(key);

    let resolved = await matchViaAI(rawName);
    if (!resolved) resolved = stripEquipmentHints(rawName);

    nameCache.set(key, resolved);
    return resolved;
}

// ── Smart Date Parser ────────────────────────────────────
const MONTH_MAP = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
    nov: 10, november: 10, dec: 11, december: 11,
};

function smartParseDate(raw) {
    if (!raw) return null;
    const s = raw.trim();

    // 1. Try native Date parsing (handles ISO 8601, "2025-03-05 16:27:00", etc.)
    let d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    // 2. "5 Mar 16:27" or "5 Mar 2025, 16:27" or "5 March" or "5 Mar 2025"
    const dayFirst = s.match(/^(\d{1,2})\s+([a-z]+)\s*(\d{4})?,?\s*(\d{1,2}:\d{2}(?::\d{2})?)?$/i);
    if (dayFirst) {
        const day = parseInt(dayFirst[1]);
        const mon = MONTH_MAP[dayFirst[2].toLowerCase()];
        const year = dayFirst[3] ? parseInt(dayFirst[3]) : new Date().getFullYear();
        const [hh, mm, ss] = (dayFirst[4] || '0:0:0').split(':').map(Number);
        if (mon !== undefined) return new Date(year, mon, day, hh || 0, mm || 0, ss || 0);
    }

    // 3. "Mar 5, 2025 16:27" or "March 5 2025" or "Mar 5"
    const monFirst = s.match(/^([a-z]+)\s+(\d{1,2}),?\s*(\d{4})?,?\s*(\d{1,2}:\d{2}(?::\d{2})?)?$/i);
    if (monFirst) {
        const mon = MONTH_MAP[monFirst[1].toLowerCase()];
        const day = parseInt(monFirst[2]);
        const year = monFirst[3] ? parseInt(monFirst[3]) : new Date().getFullYear();
        const [hh, mm, ss] = (monFirst[4] || '0:0:0').split(':').map(Number);
        if (mon !== undefined) return new Date(year, mon, day, hh || 0, mm || 0, ss || 0);
    }

    // 4. "DD/MM/YYYY" or "MM/DD/YYYY" or "DD-MM-YYYY"
    const slashParts = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/);
    if (slashParts) {
        const yr = slashParts[3].length === 2 ? 2000 + parseInt(slashParts[3]) : parseInt(slashParts[3]);
        const [hh, mm, ss] = (slashParts[4] || '0:0:0').split(':').map(Number);
        // Try MM/DD first, then DD/MM
        d = new Date(yr, parseInt(slashParts[1]) - 1, parseInt(slashParts[2]), hh || 0, mm || 0, ss || 0);
        if (!isNaN(d.getTime()) && d.getDate() === parseInt(slashParts[2])) return d;
        d = new Date(yr, parseInt(slashParts[2]) - 1, parseInt(slashParts[1]), hh || 0, mm || 0, ss || 0);
        if (!isNaN(d.getTime())) return d;
    }

    // 5. YYYY-MM-DD with optional time
    const isoParts = s.match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
    if (isoParts) {
        const [hh, mm, ss] = (isoParts[4] || '0:0:0').split(':').map(Number);
        return new Date(parseInt(isoParts[1]), parseInt(isoParts[2]) - 1, parseInt(isoParts[3]), hh || 0, mm || 0, ss || 0);
    }

    return null;
}

// ── Main Import Function ─────────────────────────────────

/**
 * Parse CSV text and return workout sessions + stats.
 * Dynamically adapts to whatever columns are present.
 */
export async function parseAndImportCSV(csvText, onProgress, checkCancel) {
    const { headers, rows } = parseCSV(csvText);
    const errors = [];

    if (rows.length === 0) {
        return { sessions: [], stats: { workouts: 0, exercises: 0, sets: 0 }, errors: ['CSV file appears empty or unreadable.'] };
    }

    // ── Detect available columns ──
    const colMap = buildColumnMap(headers);

    // Log which columns were detected for debugging
    const detected = Object.entries(colMap).filter(([, v]) => v).map(([k]) => k);
    console.log('CSV columns detected:', detected.join(', '));

    // Must have at minimum a date-like column and an exercise-like column
    if (!colMap.date && !colMap.exerciseName) {
        // Try treating first column as date and second as exercise name
        if (headers.length >= 2) {
            colMap.date = headers[0];
            colMap.exerciseName = headers[1];
            console.log('Fallback: using first column as date, second as exercise');
        } else {
            return { sessions: [], stats: { workouts: 0, exercises: 0, sets: 0 }, errors: ['Could not detect Date or Exercise columns. Please check your CSV format.'] };
        }
    }

    // If we have date but no exercise, try the next unassigned column
    if (colMap.date && !colMap.exerciseName) {
        const unassigned = headers.find(h => h !== colMap.date && !Object.values(colMap).includes(h));
        if (unassigned) colMap.exerciseName = unassigned;
    }
    if (!colMap.date && colMap.exerciseName) {
        const unassigned = headers.find(h => h !== colMap.exerciseName && !Object.values(colMap).includes(h));
        if (unassigned) colMap.date = unassigned;
    }

    if (!colMap.date || !colMap.exerciseName) {
        return { sessions: [], stats: { workouts: 0, exercises: 0, sets: 0 }, errors: ['Could not detect Date or Exercise columns.'] };
    }

    // ── Group rows into sessions ──
    const sessionMap = new Map();
    for (const row of rows) {
        const d = getField(row, colMap, 'date');
        const exName = getField(row, colMap, 'exerciseName');
        if (!d || !exName) {
            errors.push('Skipped row: missing date or exercise name');
            continue;
        }

        const wName = getField(row, colMap, 'workoutName');
        // Session key: group by date (date part only) + workout name
        const dateOnly = d.slice(0, 10);
        const sessionKey = `${dateOnly}::${wName}`;

        if (!sessionMap.has(sessionKey)) {
            let durSec = parseDuration(getField(row, colMap, 'duration'));

            // Fallback: If no duration column is found, calculate from Start Time and End Time columns
            if (!durSec) {
                const endTimeRaw = getField(row, colMap, 'endTime');
                if (endTimeRaw && d) {
                    const parsedStart = smartParseDate(d);
                    const parsedEnd = smartParseDate(endTimeRaw);
                    if (parsedStart && parsedEnd && !isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
                        const diffSecs = Math.round((parsedEnd.getTime() - parsedStart.getTime()) / 1000);
                        if (diffSecs > 0) {
                            durSec = diffSecs;
                        }
                    }
                }
            }

            sessionMap.set(sessionKey, {
                date: d,
                workoutName: wName || 'Imported Workout',
                duration: durSec,
                exercises: new Map(), // exerciseName -> sets config
            });
        }

        const session = sessionMap.get(sessionKey);
        if (!session.exercises.has(exName)) {
            session.exercises.set(exName, []);
        }

        const exSets = session.exercises.get(exName);
        let reps = getField(row, colMap, 'reps');
        let weight = getField(row, colMap, 'weight');
        let weightUnit = getField(row, colMap, 'weightUnit') || 'kg';
        let setOrder = getField(row, colMap, 'setOrder');

        // Hevy specific: weight heading might contain unit
        if (colMap.weight && colMap.weight.includes('lbs')) weightUnit = 'lbs';
        if (colMap.weight && colMap.weight.includes('kg')) weightUnit = 'kg';

        if (reps) reps = reps.replace(/[^0-9.]/g, '');
        if (weight) weight = weight.replace(/[^0-9.]/g, '');

        if (!setOrder) {
            setOrder = (exSets.length + 1).toString();
        }

        exSets.push({
            weight,
            weightUnit,
            reps: reps || '',
            setOrder,
        });
    }

    // ── Resolve exercise names & build sessions ──
    const sessions = [];
    const uniqueExercises = new Set();
    let totalSets = 0;
    const sessionEntries = Array.from(sessionMap.entries());

    for (let i = 0; i < sessionEntries.length; i++) {
        if (checkCancel && checkCancel()) {
            throw new Error('IMPORT_CANCELLED');
        }

        const [, sessionData] = sessionEntries[i];
        if (onProgress) onProgress(i + 1, sessionEntries.length);

        let startDate;
        try {
            startDate = smartParseDate(sessionData.date);
        } catch (e) {
            errors.push(`Invalid date: ${sessionData.date}`);
            continue;
        }

        if (!startDate || isNaN(startDate.getTime())) {
            errors.push(`Invalid date: ${sessionData.date}`);
            continue;
        }

        const finishDate = new Date(startDate.getTime() + (sessionData.duration * 1000));

        const exerciseLogs = [];
        for (const [rawExName, sets] of sessionData.exercises) {
            // Check cancellation repeatedly around slow API calls
            if (checkCancel && checkCancel()) {
                throw new Error('IMPORT_CANCELLED');
            }

            const resolvedName = await resolveExerciseName(rawExName);
            uniqueExercises.add(resolvedName.toLowerCase());

            sets.sort((a, b) => a.setOrder - b.setOrder);

            exerciseLogs.push({
                name: resolvedName,
                sets: sets.map((s, idx) => ({
                    id: `import-${startDate.getTime()}-${idx}`,
                    setNum: idx + 1,
                    weight: s.weight || '',
                    reps: s.reps || '',
                    completed: true,
                    isPR: false,
                })),
            });
            totalSets += sets.length;
        }

        sessions.push({
            id: `import-${startDate.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
            routineName: sessionData.workoutName,
            startedAt: startDate.toISOString(),
            finishedAt: finishDate.toISOString(),
            elapsedSeconds: sessionData.duration,
            exerciseLogs,
            imported: true,
        });
    }

    sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    // ── Extract Routines ──
    const routinesMap = new Map();
    // Because sessions are sorted newest to oldest, the first time we see a routineName,
    // it will be the most recent version of that workout.
    for (const session of sessions) {
        if (!session.routineName || session.routineName.trim() === '' || session.routineName === 'Imported Workout') continue;

        const rName = session.routineName.trim();
        if (!routinesMap.has(rName)) {
            const exList = session.exerciseLogs.map(ex => {
                // Get the best rep/weight from the set with the highest weight
                let defaultReps = '10';
                let defaultWeight = '0';
                if (ex.sets && ex.sets.length > 0) {
                    let maxWeight = -1;
                    ex.sets.forEach(set => {
                        const w = parseFloat(set.weight) || 0;
                        if (w > maxWeight) {
                            maxWeight = w;
                            defaultWeight = set.weight || '0';
                            defaultReps = set.reps || '10';
                        }
                    });
                }

                return {
                    name: ex.name,
                    sets: ex.sets ? ex.sets.length : 3,
                    reps: defaultReps,
                    weight: defaultWeight,
                    restTime: '01:30',
                    bodyPart: '',
                    target: '',
                    equipment: ''
                };
            });

            routinesMap.set(rName, {
                name: rName,
                exercises: exList
            });
        }
    }
    const extractedRoutines = Array.from(routinesMap.values());

    return {
        sessions,
        routines: extractedRoutines,
        stats: {
            workouts: sessions.length,
            exercises: uniqueExercises.size,
            sets: totalSets,
            routines: extractedRoutines.length,
        },
        errors,
    };
}
