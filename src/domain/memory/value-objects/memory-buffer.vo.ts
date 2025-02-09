import { Memory } from '../entities/memory.entity';

export class MemoryBuffer {
    private entries: Memory[] = [];
    private currentSize: number = 0;

    constructor(private readonly maxSize: number) { }

    add(memory: Memory): void {
        if (this.currentSize < this.maxSize) {
            this.entries.push(memory);
            this.currentSize++;
        }
    }

    remove(id: string): void {
        this.entries = this.entries.filter(m => m.id !== id);
        this.currentSize--;
    }

    getEntries(): Memory[] {
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

    findLeastImportant(): Memory | null {
        if (this.currentSize === 0) return null;
        return this.entries.reduce((min, current) =>
            current.importance < min.importance ? current : min
        );
    }
}