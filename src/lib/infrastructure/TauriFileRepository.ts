import { FormFactor } from '../core/schema';
import { FormInfo, FormRepository } from '../core/repository';
// import { writeTextFile, readTextFile, removeFile, readDir, BaseDirectory } from '@tauri-apps/api/fs';
// import { documentDir } from '@tauri-apps/api/path';

/**
 * Tauri-based File System Repository.
 * Saves forms as .formia (JSON) files in the user's documents directory.
 */
export class TauriFileRepository implements FormRepository {
  private async getBaseDir() {
    // [PLACEHOLDER] In a real Tauri app, this would get the correct document path
    // return await documentDir();
    return 'Documents/Formia';
  }

  async save(id: string, content: FormFactor): Promise<void> {
    const filename = `${id}.formia`;
    const data = JSON.stringify(content, null, 2);
    
    console.log(`[Tauri] Saving ${filename} to disk...`);
    // [PLACEHOLDER] Actual Tauri FS call
    // await writeTextFile(filename, data, { dir: BaseDirectory.Document });
  }

  async load(id: string): Promise<FormFactor> {
    const filename = `${id}.formia`;
    console.log(`[Tauri] Loading ${filename}...`);
    
    // [PLACEHOLDER] Actual Tauri FS call
    // const data = await readTextFile(filename, { dir: BaseDirectory.Document });
    // return JSON.parse(data);
    
    throw new Error('Load not implemented in placeholder mode');
  }

  async list(): Promise<FormInfo[]> {
    console.log('[Tauri] Listing all .formia files...');
    // [PLACEHOLDER] Actual Tauri FS call to read directory
    return [];
  }

  async delete(id: string): Promise<void> {
    const filename = `${id}.formia`;
    console.log(`[Tauri] Deleting ${filename}...`);
    // [PLACEHOLDER] Actual Tauri FS call
    // await removeFile(filename, { dir: BaseDirectory.Document });
  }
}
