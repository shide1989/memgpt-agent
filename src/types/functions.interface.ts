import { MemoryCategory, MemoryMetadata } from "./memory.interface";

/**
 * Available memory management functions
 */
export enum MemoryFunction {
    INSERT = 'insert_memory',
    RECALL = 'recall_memory',
    UPDATE = 'update_memory',
    DELETE = 'delete_memory',
    SEARCH = 'search_memory'
}

/**
 * Base interface for function parameters
 */
export interface FunctionParams {
    functionName: MemoryFunction;
}

/**
 * Parameters for memory insertion
 */
export interface InsertMemoryParams extends FunctionParams {
    content: string;
    category: MemoryCategory;
    importance?: number;
    metadata?: Partial<MemoryMetadata>;
}

/**
 * Parameters for memory recall
 */
export interface RecallMemoryParams extends FunctionParams {
    id?: string;
    query?: string;
    category?: MemoryCategory;
}

/**
 * Parameters for memory update
 */
export interface UpdateMemoryParams extends FunctionParams {
    id: string;
    content?: string;
    importance?: number;
    metadata?: Partial<MemoryMetadata>;
}

/**
 * Parameters for memory deletion
 */
export interface DeleteMemoryParams extends FunctionParams {
    id: string;
}

/**
 * Parameters for memory search
 */
export interface SearchMemoryParams extends FunctionParams {
    query: string;
    category?: MemoryCategory;
    limit?: number;
}

/**
 * Function call result
 */
export interface FunctionCallResult {
    success: boolean;
    message: string;
    data?: any;
    error?: Error;
}

/**
 * Function definition for OpenAI function calling
 */
export interface FunctionDefinition {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required: string[];
    };
}

interface SummarizeMemoryParams extends FunctionParams {
    category: MemoryCategory;
    detailed?: boolean;
    timeframe?: string;
}