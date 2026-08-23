import { CollectionExportData } from '../types/collection';
import { exportAllData, importData } from './db';

/**
 * Downloads current collection data as a JSON file.
 */
export async function downloadCollectionBackup(): Promise<void> {
  const data = await exportAllData();
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().split('T')[0];
  const link = document.createElement('a');
  link.href = url;
  link.download = `osu-beatmap-gacha-backup-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates the schema of an imported backup JSON.
 */
export function validateImportData(obj: any): { valid: boolean; error?: string; data?: CollectionExportData } {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, error: 'File does not contain valid JSON object.' };
  }

  if (typeof obj.version !== 'number') {
    return { valid: false, error: 'Missing or invalid "version" field.' };
  }

  if (!Array.isArray(obj.records)) {
    return { valid: false, error: 'Missing "records" list in backup.' };
  }

  for (let i = 0; i < Math.min(obj.records.length, 50); i++) {
    const r = obj.records[i];
    if (typeof r.beatmapId !== 'number' || typeof r.copies !== 'number') {
      return { valid: false, error: `Invalid collection record at index ${i}.` };
    }
  }

  return { valid: true, data: obj as CollectionExportData };
}

/**
 * Reads a user-selected File, validates, and imports into IndexedDB.
 */
export async function handleFileImport(
  file: File,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ success: boolean; message: string; importedCount?: number }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const validation = validateImportData(parsed);

    if (!validation.valid || !validation.data) {
      return { success: false, message: validation.error || 'Invalid backup structure.' };
    }

    const result = await importData(validation.data, mode);
    return {
      success: true,
      message: `Successfully imported ${result.importedRecords} beatmaps and ${result.importedHistory} history entries!`,
      importedCount: result.importedRecords,
    };
  } catch (err: any) {
    return { success: false, message: `Failed to read file: ${err.message || 'Unknown error'}` };
  }
}
