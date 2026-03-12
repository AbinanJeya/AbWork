/**
 * CSV Workout History Export
 *
 * Flattens the app's deeply nested WORKOUT_HISTORY schema into a flat,
 * 1-row-per-set CSV format that perfectly matches Hevy & Strong exports.
 *
 * Columns: Date, Workout Name, Exercise Name, Set Order, Weight, Weight Unit, Reps, duration_seconds
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getWorkoutHistory } from './storage';

// ── CSV Creation ─────────────────────────────────────────

function escapeCSV(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Escape quotes and wrap in quotes if it contains commas, quotes, or newlines
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function buildCSVString(rows) {
    if (!rows || rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const headerRow = headers.map(escapeCSV).join(',');
    const dataRows = rows.map(row => headers.map(h => escapeCSV(row[h])).join(','));
    return [headerRow, ...dataRows].join('\n');
}

// ── Export Logic ─────────────────────────────────────────

/**
 * Format date as "DD MMM YYYY, HH:mm" (e.g. "5 Mar 2026, 16:27")
 * Matches Hevy's exact export format
 */
function formatHevyDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate();
    const mon = months[d.getMonth()];
    const yr = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');

    return `${day} ${mon} ${yr}, ${hh}:${mm}`;
}

/**
 * Takes the internal WORKOUT_HISTORY array and converts it to a flat array of flat objects.
 */
function flattenHistoryToCSVRows(history) {
    const rows = [];

    for (const session of history) {
        const title = session.routineName || 'Workout';
        const startTime = formatHevyDate(session.startedAt);
        const durationSeconds = session.elapsedSeconds || 0;

        // If a session has no exercises, skip it or add a blank row?
        // Usually, empty sessions aren't exported.
        if (!session.exerciseLogs || session.exerciseLogs.length === 0) continue;

        for (const ex of session.exerciseLogs) {
            const exerciseTitle = ex.name;

            if (!ex.sets || ex.sets.length === 0) continue;

            for (let i = 0; i < ex.sets.length; i++) {
                const set = ex.sets[i];
                // Only export completed sets (or all sets? Usually only completed are exported)
                // If you want ALL sets, remove `if (!set.completed) continue;`
                // Let's export all sets that have at least reps or weight
                if (!set.reps && !set.weight) continue;

                rows.push({
                    title,
                    start_time: startTime,
                    exercise_title: exerciseTitle,
                    set_index: i,
                    weight: set.weight || '',
                    weight_unit: set.weightUnit || 'kg', // Fallback to kg
                    reps: set.reps || '',
                    duration_seconds: durationSeconds,
                });
            }
        }
    }

    return rows;
}

/**
 * Main export function: reads history, formats to CSV, writes to cache, and triggers native share.
 */
export async function exportWorkoutHistoryToCSV() {
    try {
        const history = await getWorkoutHistory();
        if (!history || history.length === 0) {
            return { success: false, error: 'No workout history found to export.' };
        }

        const flatRows = flattenHistoryToCSVRows(history);
        if (flatRows.length === 0) {
            return { success: false, error: 'No valid sets found in workout history.' };
        }

        const csvString = buildCSVString(flatRows);

        // Save to cache directory
        const fileName = `workout_data_export_${new Date().toISOString().slice(0, 10)}.csv`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, csvString, {
            encoding: FileSystem.EncodingType.UTF8
        });

        // Trigger native share sheet
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
            return { success: false, error: 'Sharing is not available on this device.' };
        }

        await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Workout History',
            UTI: 'public.comma-separated-values-text' // iOS specific
        });

        return { success: true };
    } catch (err) {
        console.error('Export error:', err);
        return { success: false, error: err.message };
    }
}
