import { FunctionCallerService } from './function-caller.service';
import { MemoryManager } from '../../memory/services/memory-manager.service';

import { ChatConfig, Message } from '../interfaces/chat.interface';
import { FunctionCallResult } from '../interfaces/functions.interface';

import { OpenAIService } from '../../../infrastructure/openai/openai.service';
import { Logger } from '../../../infrastructure/logging/logger.service';
import { BASE_SYS_PROMPT } from '../config/prompt.config';
import { ContextBuilderService } from './context-builder.service';
import { HeartbeatManager } from './heartbeat-manager.service';
import { MemoryCategory } from '../../memory/interfaces/memory.interface';
import { ChatCompletionMessage } from 'openai/resources';

export class ChatManager extends OpenAIService {
    private memoryManager: MemoryManager;
    private functionCaller: FunctionCallerService;
    private contextBuilder: ContextBuilderService;
    private heartbeatManager: HeartbeatManager;

    private config: ChatConfig;
    private conversationHistory: Message[] = [];
    private isProcessing: boolean = false;

    constructor(
        config: Partial<ChatConfig> = {}
    ) {
        super();
        this.memoryManager = new MemoryManager();
        this.functionCaller = new FunctionCallerService(this.memoryManager);
        this.contextBuilder = new ContextBuilderService();
        this.heartbeatManager = new HeartbeatManager(this, this.memoryManager);

        // Default configuration
        this.config = {
            model: 'gpt-4o',
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

        // Start heartbeat
        this.heartbeatManager.startHeartbeat();
    }

    public async chat(userInput: string): Promise<string> {
        try {
            this.isProcessing = true;
            // Notify heartbeat of user interaction
            this.heartbeatManager.updateLastInteraction();

            // Add user input to conversation history
            this.conversationHistory.push({
                role: 'user',
                content: userInput
            });

            // Get completion from OpenAI
            const completion = await this.openai.chat.completions.create({
                model: this.config.model,
                messages: this.conversationHistory,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
                functions: this.functionCaller.getFunctionDefinitions(),
                function_call: 'auto'
            });

            const response = completion.choices[0].message;

            // Handle function calls if present
            if (response.function_call) {
                return await this.handleFunctionCallResponse(response);
            }

            // Handle regular response
            return await this.handleRegularResponse(response);

        } catch (error) {
            console.error('Error in chat:', error);
            throw new Error(`Chat error: ${(error as Error).message}`);
        }
    }

    private async handleFunctionCallResponse(response: ChatCompletionMessage): Promise<string> {
        const functionResult = await this.handleFunctionCall(response.function_call!);

        // Add function result to conversation
        this.conversationHistory.push({
            role: 'function',
            name: response.function_call!.name,
            content: JSON.stringify(functionResult.data)
        });

        // Get another completion to process function result
        const secondCompletion = await this.openai.chat.completions.create({
            model: this.config.model,
            messages: this.conversationHistory,
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens
        });

        const finalResponse = secondCompletion.choices[0].message;

        // Store assistant's response in working memory
        await this.memoryManager.insertMemory(
            finalResponse.content || '',
            MemoryCategory.WORKING,
            0.6,
            {
                type: 'assistant_response',
                // functionCall: response.function_call.name
            }
        );

        this.conversationHistory.push({
            role: 'assistant',
            content: finalResponse.content || ''
        });

        return finalResponse.content || '';
    }

    private async handleRegularResponse(response: any): Promise<string> {
        // Store assistant's response in working memory
        await this.memoryManager.insertMemory(
            response.content || '',
            MemoryCategory.WORKING,
            0.6,
            { type: 'assistant_response' }
        );

        this.conversationHistory.push({
            role: 'assistant',
            content: response.content || ''
        });

        return response.content || '';
    }

    public async getReflection(prompt: string): Promise<string> {
        try {
            const completion = await this.openai.chat.completions.create({
                model: this.config.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are performing self-reflection. Analyze the given context and provide insights.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            });

            return completion.choices[0].message.content || '';
        } catch (error) {
            Logger.error('Error getting reflection:', error as Error);
            throw error;
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

    public isCurrentlyProcessing(): boolean {
        return this.isProcessing;
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

    public cleanup(): void {
        this.heartbeatManager.stopHeartbeat();
    }
}