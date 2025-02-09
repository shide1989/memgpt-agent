export class MemoryOperationResult<T = any> {
    constructor(
        public readonly success: boolean,
        public readonly message: string,
        public readonly data?: T
    ) { }

    static success<T>(message: string, data?: T): MemoryOperationResult<T> {
        return new MemoryOperationResult(true, message, data);
    }

    static failure(message: string): MemoryOperationResult {
        return new MemoryOperationResult(false, message);
    }
}