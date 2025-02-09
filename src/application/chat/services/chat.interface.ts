import { ChatCompletionMessageParam, ChatModel } from 'openai/resources/chat';

export type Message = ChatCompletionMessageParam;

export interface ChatConfig {
    model: ChatModel;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
}