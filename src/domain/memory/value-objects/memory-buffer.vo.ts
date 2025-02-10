import { MemoryEntity } from '../entities/memory.entity';

export class MemoryBuffer {
    private entries: MemoryEntity[] = [];
    private currentSize: number = 0;

    constructor(private readonly maxSize: number) { }

    add(memory: MemoryEntity): void {
        if (this.currentSize < this.maxSize) {
            this.entries.push(memory);
            this.currentSize++;
        }
    }

    remove(id: string): void {
        this.entries = this.entries.filter(m => m.id !== id);
        this.currentSize--;
    }

    getEntries(): MemoryEntity[] {
        return [...this.entries];
    }

    getMaxSize(): number {
        return this.maxSize;
    }

    getCurrentSize(): number {
        return this.currentSize;
    }

    isFull(): boolean {
        return this.currentSize >= this.maxSize;
    }

    findLeastImportant(): MemoryEntity | null {
        if (this.currentSize === 0) return null;
        return this.entries.reduce((min, current) =>
            current.importance < min.importance ? current : min
        );
    }
}