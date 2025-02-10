import { TemplateEngine } from "../../../infrastructure/templating/template.engine";
import { MemoryBuffer } from "../value-objects";

export class CompilationService {
    private readonly templateEngine: TemplateEngine = new TemplateEngine();

    /**
     * Compile a template with the given memories.
     * Supports basic memory compilation with Handlebars templating:
     * - {{memories}} - All memories as a formatted list
     * - {{core}} - Core memories
     * - {{working}} - Working memories
     * - {{archival}} - Archival memories
     * - {{importance threshold}} - Memories above importance threshold
     */
    compile(memories: MemoryBuffer, templateName: string): string {
        try {
            const template = this.templateEngine.getTemplate(templateName as any);
            return this.templateEngine.compile(template, memories);

        } catch (error) {
            throw new Error(`Template compilation failed: ${(error as Error).message}`);
        }
    }
}