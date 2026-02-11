import { FormFactor } from '../core/schema';
import { FormInfo, FormRepository } from '../core/repository';

/**
 * LocalStorageRepository — Guest mode storage for Web users.
 * Saves forms to the browser's localStorage.
 */
export class LocalStorageRepository implements FormRepository {
  private prefix = 'formia_draft_';

  async save(id: string, content: FormFactor): Promise<void> {
    const key = `${this.prefix}${id}`;
    localStorage.setItem(key, JSON.stringify(content));
    
    // Update index for list()
    const index = this.getIndex();
    const updatedIndex = {
      ...index,
      [id]: {
        id,
        title: content.metadata.title,
        updatedAt: content.metadata.updatedAt || new Date().toISOString()
      }
    };
    localStorage.setItem(`${this.prefix}index`, JSON.stringify(updatedIndex));
  }

  async load(id: string): Promise<FormFactor> {
    const key = `${this.prefix}${id}`;
    const data = localStorage.getItem(key);
    if (!data) throw new Error(`Form ${id} not found in localStorage`);
    return JSON.parse(data);
  }

  async list(): Promise<FormInfo[]> {
    const index = this.getIndex();
    return Object.values(index).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async delete(id: string): Promise<void> {
    localStorage.removeItem(`${this.prefix}${id}`);
    const index = this.getIndex();
    delete index[id];
    localStorage.setItem(`${this.prefix}index`, JSON.stringify(index));
  }

  private getIndex(): Record<string, FormInfo> {
    const data = localStorage.getItem(`${this.prefix}index`);
    return data ? JSON.parse(data) : {};
  }
}
