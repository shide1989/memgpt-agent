# MemGPT POC

A proof-of-concept implementation of a MemGPT-style chatbot with self-managed memory capabilities.

## Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Copy `.env.example` to `.env` and add your OpenAI API key
4. Run the development server: `pnpm dev`

## Scripts

- `pnpm start` - Run the compiled application
- `pnpm build` - Build the TypeScript code
- `pnpm test` - Run tests
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm dev` - Run in development mode with hot reload

### Example chat

```
❯ pnpm start

MemGPT Chat initialized. Type "exit" to quit.
---------------------------------------------
You: my name is seb
[Function] insert_memory {
  "content": "Seb",
  "category": "core",
  "importance": 1
}
[Memory] Inserting {
  "category": "core",
  "content": "Seb...",
  "importance": 1
}

=== Memory State ===
Working Memory: 0/10
Core Memory: 1/5
Archival Memory: 0 entries
==================


Assistant: Nice to meet you, Seb! How can I assist you today? 

You: what is my name
[Function] search_memory {
  "query": "Seb",
  "category": "core"
}
[Memory] Search Results {
  "count": 1
}

Assistant: Your name is Seb. 

You: exit
```