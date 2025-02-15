import { FunctionCallerService } from './function-caller.service';
import { MemoryManager } from '../../memory/services/memory-manager.service';

import { ChatConfig, Message } from '../interfaces/chat.interface';
import { FunctionCallResult } from '../interfaces/functions.interface';

import { OpenAIService } from '../../../infrastructure/llms/openai.service';
import { Logger } from '../../../infrastructure/logging/logger.service';
import { BASE_SYS_PROMPT } from '../config/prompt.config';
import { ContextBuilderService } from './context-builder.service';

export class ChatManager extends OpenAIService {
    private memoryManager: MemoryManager;
    private functionCaller: FunctionCallerService;
    private contextBuilder: ContextBuilderService;
    private config: ChatConfig;
    private conversationHistory: Message[] = [];

    constructor(
        config: Partial<ChatConfig> = {}
    ) {
        super();
        this.memoryManager = new MemoryManager();
        this.functionCaller = new FunctionCallerService(this.memoryManager);

        this.contextBuilder = new ContextBuilderService();
        // Default configuration
        this.config = {
            model: 'gpt-4o-mini',
            temperature: 0.5,
            maxTokens: 2000,
            systemPrompt: `You are an AI assistant with self-managed memory capabilities.`,
            ...config
        };

    }

    public async init() {
        await this.memoryManager.loadMemoriesFromDB();
        // this.config.systemPrompt = BASE_SYS_PROMPT + '\n[MEMORY]\n' + this.memoryManager.getCoreMemory().map(m => m.content).join('\n')
        this.config.systemPrompt = BASE_SYS_PROMPT + '\n[MEMORY]\n' + this.contextBuilder.buildContext(this.memoryManager.getCoreMemory())

        // Initialize conversation with system prompt
        this.conversationHistory.push({
            role: 'system',
            content: this.config.systemPrompt
        });
    }

    public async chat(userInput: string): Promise<string> {
        try {
            // Add user input to conversation history
            this.conversationHistory.push({
                role: 'user',
                content: userInput
            });

            // Get completion using parent class method
            const response = await this.createChatCompletion(
                this.conversationHistory,
                {
                    temperature: this.config.temperature,
                    max_tokens: this.config.maxTokens,
                    functions: this.functionCaller.getFunctionDefinitions(),
                    function_call: 'auto'
                }
            );

            // Add assistant's response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: response.content || '',
                ...(response.tool_calls && { tool_calls: response.tool_calls })
            });

            // If no tool calls, return content directly
            if (!response.tool_calls?.length) {
                return response.content || '';
            }

            // Handle all tool calls
            for (const toolCall of response.tool_calls) {
                const functionResult = await this.handleFunctionCall(toolCall);

                // Add function result to conversation
                this.conversationHistory.push({
                    role: 'tool',
                    name: toolCall.name,
                    content: JSON.stringify(functionResult.data)
                });
            }

            // Get final response after function calls
            const finalResponse = await this.createChatCompletion(
                this.conversationHistory,
                {
                    temperature: this.config.temperature,
                    max_tokens: this.config.maxTokens
                }
            );

            // Add final response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: finalResponse.content || ''
            });

            return finalResponse.content || '';
        } catch (error) {
            console.error('Error in chat:', error);
            throw new Error(`Chat error: ${(error as Error).message}`);
        }
    }

    private async handleFunctionCall(
        functionCall: { name: string; arguments: string }
    ): Promise<FunctionCallResult> {
        try {
            Logger.function(functionCall.name, JSON.parse(functionCall.arguments));
            const args = JSON.parse(functionCall.arguments);
            return await this.functionCaller.executeFunction(
                functionCall.name as any,
                args
            );
        } catch (error) {
            Logger.error(error as Error);
            return {
                success: false,
                message: `Function execution failed: ${(error as Error).message}`,
                error: error as Error
            };
        }
    }

    public getConversationHistory(): Message[] {
        return this.conversationHistory;
    }

    public clearConversation(): void {
        this.conversationHistory = [{
            role: 'system',
            content: this.config.systemPrompt
        }];
    }
}