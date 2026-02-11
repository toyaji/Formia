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
  async getStoragePath() {
    const docDir = await documentDir();
    return await join(docDir, 'Formia');
  }

  private async ensureDir() {
    if (!await exists('Formia', { baseDir: BaseDirectory.Document })) {
      await mkdir('Formia', { baseDir: BaseDirectory.Document });
    }
  }

  async save(id: string, content: FormFactor): Promise<void> {
    await this.ensureDir();
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
          try {
            const data = await readTextFile(`Formia/${entry.name}`, { baseDir: BaseDirectory.Document });
            const form = JSON.parse(data) as FormFactor;
            forms.push({
              id,
              title: form.metadata.title,
              updatedAt: form.metadata.updatedAt
            });
          } catch (err) {
            console.error(`[Tauri] Failed to read ${entry.name}:`, err);
          }
        }
      }
      return forms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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

  /**
   * Imports a .formia file from an absolute path into the local repository.
   */
  async importExternalFile(path: string): Promise<string> {
    try {
      const data = await readTextFile(path);
      const content = JSON.parse(data) as FormFactor;
      const id = content.metadata.title.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now().toString().slice(-4);
      await this.save(id, content);
      return id;
    } catch (e) {
      console.error('[Tauri] Failed to import file:', e);
      throw e;
    }
  }
}
