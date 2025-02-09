import {
    FunctionDefinition,
    MemoryFunction,
    FunctionCallResult,
    InsertMemoryParams,
    RecallMemoryParams,
    SearchMemoryParams
} from './functions.interface';
import { MemoryManager } from '../../memory/services/memory-manager.service';

export class FunctionCaller {
    private memoryManager: MemoryManager;

    constructor(memoryManager: MemoryManager) {
        this.memoryManager = memoryManager;
    }

    // Function definitions for OpenAI function calling
    public getFunctionDefinitions(): FunctionDefinition[] {
        return [
            {
                name: MemoryFunction.INSERT,
                description: 'Insert a new memory into the system',
                parameters: {
                    type: 'object',
                    properties: {
                        content: {
                            type: 'string',
                            description: 'The content of the memory to store'
                        },
                        category: {
                            type: 'string',
                            enum: ['core', 'working', 'archival'],
                            description: 'The category of memory to store'
                        },
                        importance: {
                            type: 'number',
                            description: 'Importance score (0-1) of the memory',
                            minimum: 0,
                            maximum: 1
                        }
                    },
                    required: ['content', 'category']
                }
            },
            {
                name: MemoryFunction.SEARCH,
                description: 'Search for memories based on query',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query'
                        },
                        category: {
                            type: 'string',
                            enum: ['core', 'working', 'archival'],
                            description: 'Optional category to search within'
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of results to return'
                        }
                    },
                    required: ['query']
                }
            }
        ];
    }

    public async executeFunction(
        functionName: MemoryFunction,
        parameters: any
    ): Promise<FunctionCallResult> {
        try {
            switch (functionName) {
                case MemoryFunction.INSERT:
                    return await this.handleInsertMemory(parameters as InsertMemoryParams);
                case MemoryFunction.SEARCH:
                    return await this.handleSearchMemory(parameters as SearchMemoryParams);
                default:
                    throw new Error(`Unknown function: ${functionName}`);
            }
        } catch (error) {
            return {
                success: false,
                message: `Function execution failed: ${(error as Error).message}`,
                error: (error as Error)
            };
        }
    }

    private async handleInsertMemory(
        params: InsertMemoryParams
    ): Promise<FunctionCallResult> {
        const result = await this.memoryManager.insertMemory(
            params.content,
            params.category,
            params.importance,
            params.metadata
        );

        return {
            success: result.success,
            message: result.message,
            data: result.data
        };
    }

    private async handleSearchMemory(
        params: SearchMemoryParams
    ): Promise<FunctionCallResult> {
        const result = await this.memoryManager.searchMemory(params);

        return {
            success: result.success,
            message: result.message,
            data: result.data
        };
    }
}