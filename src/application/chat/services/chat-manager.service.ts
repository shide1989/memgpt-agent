import OpenAI from 'openai';

import { MemoryManager } from '../../memory/services/memory-manager.service';
import { FunctionCaller } from '../../../core/function-caller.class';

import { Message, ChatConfig } from '../../../types/chat.interface';
import { FunctionCallResult } from '../../../types/functions.interface';

import { Logger } from '../../../services/logger.service';
import { OpenAIService } from '../../../infrastructure/openai/openai.service';

export class ChatManager extends OpenAIService {
    private memoryManager: MemoryManager;
    private functionCaller: FunctionCaller;
    private config: ChatConfig;
    private conversationHistory: Message[] = [];

    constructor(
        config: Partial<ChatConfig> = {}
    ) {
        super();
        this.memoryManager = new MemoryManager();
        this.functionCaller = new FunctionCaller(this.memoryManager);

        // Default configuration
        this.config = {
            model: 'gpt-4o-mini',
            temperature: 0.5,
            maxTokens: 2000,
            systemPrompt: `You are an AI assistant with self-managed memory capabilities. 
You can store and recall information using your memory management functions.

When storing memories, always include:
1. The core information or fact
2. Relevant context and implications
3. Any connections to previous topics
4. Why this information might be important later

For example, instead of storing:
"User likes coffee"

Store as:
"User prefers coffee, specifically mentioning dark roasts. This came up during a discussion about morning routines. They also noted having a home espresso machine, suggesting they're serious about coffee quality. This preference might be relevant for future discussions about meetings, productivity, or lifestyle."

Memory Management Strategy:
- Store detailed, immediate context in working memory
- Move fundamental facts, preferences, and patterns to core memory
- Archive contextual details that might be useful for future reference

Always try to maintain relevant context in your working memory and store important information in core memory.
When responding, consider relevant memories and maintain conversation coherence.`,
            ...config
        };

        // Initialize conversation with system prompt
        this.conversationHistory.push({
            role: 'system',
            content: this.config.systemPrompt
        });
    }

    public async init() {
        this.memoryManager.loadMemoriesFromDB();
    }


    public async chat(userInput: string): Promise<string> {
        try {
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
                const functionResult = await this.handleFunctionCall(response.function_call);

                // Add function result to conversation
                this.conversationHistory.push({
                    role: 'function',
                    name: response.function_call.name,
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
                this.conversationHistory.push({
                    role: 'assistant',
                    content: finalResponse.content || ''
                });

                return finalResponse.content || '';
            }

            // Handle regular response
            this.conversationHistory.push({
                role: 'assistant',
                content: response.content || ''
            });

            return response.content || '';
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