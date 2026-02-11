import { FormFactor } from '../core/schema';
import { FormInfo, FormRepository } from '../core/repository';
import { 
  writeTextFile, 
  readTextFile, 
  remove, 
  exists, 
  mkdir, 
  BaseDirectory,
  readDir
} from '@tauri-apps/plugin-fs';
import { documentDir, join } from '@tauri-apps/api/path';

/**
 * Tauri-based File System Repository.
 * Saves forms as .formia (JSON) files in the user's documents directory.
 */
export class TauriFileRepository implements FormRepository {
  private async getProjectDir() {
    const docDir = await documentDir();
    const projectDir = await join(docDir, 'Formia');
    
    // Ensure project directory exists
    if (!await exists('Formia', { baseDir: BaseDirectory.Document })) {
      await mkdir('Formia', { baseDir: BaseDirectory.Document });
    }
    
    return projectDir;
  }

  async save(id: string, content: FormFactor): Promise<void> {
    const filename = `Formia/${id}.formia`;
    const data = JSON.stringify(content, null, 2);
    
    try {
      await writeTextFile(filename, data, { baseDir: BaseDirectory.Document });
      console.log(`[Tauri] Saved ${filename} successfully.`);
    } catch (e) {
      console.error(`[Tauri] Failed to save ${filename}:`, e);
      throw e;
    }
  }

  async load(id: string): Promise<FormFactor> {
    const filename = `Formia/${id}.formia`;
    try {
      const data = await readTextFile(filename, { baseDir: BaseDirectory.Document });
      return JSON.parse(data);
    } catch (e) {
      console.error(`[Tauri] Failed to load ${filename}:`, e);
      throw e;
    }
  }

  async list(): Promise<FormInfo[]> {
    try {
      if (!await exists('Formia', { baseDir: BaseDirectory.Document })) {
        return [];
      }
      
      const entries = await readDir('Formia', { baseDir: BaseDirectory.Document });
      const forms: FormInfo[] = [];
      
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith('.formia')) {
          const id = entry.name.replace('.formia', '');
          // We could read metadata from inside, but for list performance, we just return basic info
          forms.push({
            id,
            title: id, // Placeholder title, should ideally be read from file or filename
            updatedAt: new Date().toISOString() // Placeholder
          });
        }
      }
      return forms;
    } catch (e) {
      console.error('[Tauri] Failed to list files:', e);
      return [];
    }
  }

  async delete(id: string): Promise<void> {
    const filename = `Formia/${id}.formia`;
    try {
      await remove(filename, { baseDir: BaseDirectory.Document });
    } catch (e) {
      console.error(`[Tauri] Failed to delete ${filename}:`, e);
      throw e;
    }
  }
}
