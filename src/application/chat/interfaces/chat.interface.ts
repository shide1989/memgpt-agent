export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
    id?: string;
    name: string;
    arguments: string;
}

export interface Message {
    role: Role;
    content: string | null;
    name?: string;           // For tool responses
    tool_calls?: ToolCall[]; // For assistant messages with tool calls
}

export interface ChatConfig {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
}