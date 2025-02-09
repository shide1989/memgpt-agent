import chalk from 'chalk'; // Add "chalk" to dependencies for colored output

export class Logger {
    static memory(action: string, details: any): void {
        console.log(
            chalk.blue('[Memory]'),
            chalk.yellow(action),
            JSON.stringify(details, null, 2)
        );
    }

    static function(name: string, args: any): void {
        console.log(
            chalk.magenta('[Function]'),
            chalk.yellow(name),
            JSON.stringify(args, null, 2)
        );
    }

    static state(message: string): void {
        console.log(
            chalk.green('[State]'),
            chalk.white(message)
        );
    }

    static error(error: Error | string, cause?: Error | string): void {
        console.error(
            chalk.red('[Error]'),
            chalk.white(typeof error === 'string' ? error : error.message),
            (error as Error).stack ? chalk.gray((error as Error).stack) : '',
            cause && chalk.yellow('\nCaused by:'),
            cause && chalk.white(typeof cause === 'string' ? cause : cause.message),
            cause && (cause as Error).stack ? chalk.gray((cause as Error).stack) : ''
        );
    }

    static memoryState(manager: any): void {
        console.log(chalk.cyan('\n=== Memory State ==='));
        console.log(chalk.yellow('Working Memory:'),
            manager.workingMemory.currentSize + '/' + manager.workingMemory.maxSize);
        console.log(chalk.yellow('Core Memory:'),
            manager.coreMemory.currentSize + '/' + manager.coreMemory.maxSize);
        console.log(chalk.yellow('Archival Memory:'),
            manager.archivalMemory.length, 'entries');
        console.log(chalk.cyan('==================\n'));
    }
}