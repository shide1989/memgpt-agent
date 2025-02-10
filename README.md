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
❯ pnpm run start

[Memory] Loading working memories {
  "count": 0
}
[Memory] Loading core memories {
  "count": 2
}
MemGPT Chat initialized. Type "exit" to quit.
---------------------------------------------
You: hi

Assistant: Hi Seb! How's your day going? 

You: exit
```

### Project Structure

```
.
├── README.md
├── docker-compose.yml
├── drizzle.config.ts
├── init.sql
├── package.json
├── pnpm-lock.yaml
├── src
│   ├── application
│   │   ├── chat
│   │   │   ├── config
│   │   │   │   └── prompt.config.ts
│   │   │   ├── interfaces
│   │   │   │   ├── chat.interface.ts
│   │   │   │   └── functions.interface.ts
│   │   │   └── services
│   │   │       ├── chat-manager.service.ts
│   │   │       ├── context-builder.service.ts
│   │   │       └── function-caller.service.ts
│   │   └── memory
│   │       ├── interfaces
│   │       │   └── memory.interface.ts
│   │       ├── services
│   │       │   └── memory-manager.service.ts
│   │       └── templates
│   │           └── index.ts
│   ├── domain
│   │   └── memory
│   │       ├── entities
│   │       │   └── memory.entity.ts
│   │       ├── repositories
│   │       │   └── memory.repository.ts
│   │       ├── services
│   │       │   ├── archival-memory.service.ts
│   │       │   ├── compilation.service.ts
│   │       │   ├── consolidation.service.ts
│   │       │   ├── search.service.ts
│   │       │   └── summarization.service.ts
│   │       └── value-objects
│   │           ├── index.ts
│   │           ├── memory-buffer.vo.ts
│   │           └── operation-result.vo.ts
│   ├── index.ts
│   └── infrastructure
│       ├── logging
│       │   └── logger.service.ts
│       ├── openai
│       │   └── openai.service.ts
│       ├── persistence
│       │   └── postgres
│       │       ├── client.ts
│       │       ├── repositories
│       │       │   └── postgres-memory.repository.ts
│       │       └── schema
│       │           └── memory.schema.ts
│       └── templating
│           └── template.engine.ts
└── tsconfig.json

25 directories, 34 files
```