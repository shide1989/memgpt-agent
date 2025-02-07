import fs from 'fs/promises';
import path from 'path';
import { MemoryEntry, MemoryBuffer } from '../types/memory.interface';

export class StorageService {
    private storagePath: string;

    constructor(storagePath: string = 'data') {
        this.storagePath = storagePath;
    }

    private async ensureDirectory(): Promise<void> {
        await fs.mkdir(this.storagePath, { recursive: true });
    }

    async saveMemories(
        working: MemoryBuffer,
        core: MemoryBuffer,
        archival: MemoryEntry[]
    ): Promise<void> {
        await this.ensureDirectory();
        const data = { working, core, archival };

        await fs.writeFile(
            path.join(this.storagePath, 'memories.json'),
            JSON.stringify(data, null, 2)
        );
    }

    async loadMemories(): Promise<{
        working: MemoryBuffer;
        core: MemoryBuffer;
        archival: MemoryEntry[];
    } | null> {
        try {
            const data = await fs.readFile(
                path.join(this.storagePath, 'memories.json'),
                'utf-8'
            );
            return JSON.parse(data);
        } catch {
            return null;
        }
    }
}