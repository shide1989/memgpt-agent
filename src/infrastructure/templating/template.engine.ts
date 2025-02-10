import Handlebars from 'handlebars';
import * as templates from '../../application/memory/templates';
import { MemoryEntity } from '../persistence/postgres/entities/memory.entity';
import { MemoryBuffer } from '../../domain/memory/value-objects';

export class TemplateEngine {
    constructor() {
        this.registerHelpers();
    }

    getTemplate(type: keyof typeof templates): string {
        if (type in templates) {
            return templates[type as keyof typeof templates];
        }
        throw new Error(`Unknown template type: ${type}`);
    }

    compile(template: string, data: any): string {
        try {
            const compiledTemplate = Handlebars.compile(template);
            return compiledTemplate(this.prepareTemplateData(data));
        } catch (error) {
            throw new Error(`Template compilation failed: ${(error as Error).message}`);
        }
    }

    private prepareTemplateData(memories: MemoryBuffer): any {
        return {
            memories: memories.getEntries(),
            core: memories.getEntries().filter(m => m.category === 'core'),
            working: memories.getEntries().filter(m => m.category === 'working'),
            archival: memories.getEntries().filter(m => m.category === 'archival'),
            stats: {
                totalMemories: memories.getEntries().length,
                coreCount: memories.getEntries().filter(m => m.category === 'core').length,
                workingCount: memories.getEntries().filter(m => m.category === 'working').length,
                archivalCount: memories.getEntries().filter(m => m.category === 'archival').length
            }
        };
    }

    private registerHelpers(): void {

        // Register custom helpers
        Handlebars.registerHelper('formatMemory', (memory) => {
            return `[${new Date(memory.timestamp).toISOString()}] (${memory.importance}): ${memory.content}`;
        });

        Handlebars.registerHelper('filterByImportance', (memories: MemoryEntity[], minThreshold: number, maxThreshold?: number) => {
            return memories.filter(m =>
                maxThreshold
                    ? m.importance >= minThreshold && m.importance < maxThreshold
                    : m.importance >= minThreshold
            );
        });

        Handlebars.registerHelper('last', (n, array) => {
            return array.slice(-n);
        });

        Handlebars.registerHelper('first', (n, array) => {
            return array.slice(0, n);
        });

        Handlebars.registerHelper('formatDate', (timestamp) => {
            return new Date(timestamp).toLocaleString();
        });

        Handlebars.registerHelper('truncate', (str, length) => {
            return str.length > length ? str.substring(0, length) + '...' : str;
        });
    }
}