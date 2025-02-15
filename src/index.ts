import dotenv from 'dotenv';
import readline from 'readline';
import { ChatManager } from './application/chat/services/chat-manager.service';

dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    if (!process.env.OPENAI_API_KEY) {
        console.error('Please set OPENAI_API_KEY in your .env file');
        process.exit(1);
    }

    const chatManager = new ChatManager();

    await chatManager.init();

    rl.on('close', () => {
        chatManager.cleanup();
        process.exit(0);
    });

    console.log('MemGPT Chat initialized. Type "exit" to quit.');
    console.log('---------------------------------------------');


    const askQuestion = () => {
        rl.question('You: ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                rl.close();
                return;
            }

            try {
                const response = await chatManager.chat(input);
                console.log('\nAssistant:', response, '\n');
            } catch (error) {
                console.error('Error:', (error as Error).message, '\n');
            }

            askQuestion();
        });
    };

    askQuestion();
}

main().catch(console.error);