export interface HeartbeatConfig {
    intervalMs: number;          // Time between heartbeats
    maxIdleTimeMs: number;      // Max time without user interaction
    minThoughtTokens: number;   // Minimum tokens for internal thoughts
    maxThoughtTokens: number;   // Maximum tokens for internal thoughts
}

export interface AgentState {
    isProcessing: boolean;
    lastUserInteraction: number;
    lastHeartbeat: number;
    currentTask?: string;
    internalMonologue?: string;
}

export interface HeartbeatResult {
    type: 'REFLECTION' | 'MEMORY_MANAGEMENT' | 'TASK_MANAGEMENT' | 'IDLE';
    action?: string;
    thoughts?: string;
}