import { ChatCompletionMessageParam } from 'openai/resources/chat';

export type Message = ChatCompletionMessageParam;

export interface ChatConfig {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
}