export const SIMPLE_TEMPLATE = `
"Core Memories:\n{{#each core}}{{formatMemory this}}\n{{/each}}"

"Important Memories (>0.8):\n{{#each (filterByImportance memories 0.8)}}{{formatMemory this}}\n{{/each}}"

"Recent Working Memory:\n{{#each working}}{{formatMemory this}}\n{{/each}}"`

// Get comprehensive overview
export const OVERVIEW_TEMPLATE = `
=== Memory Overview (Total: {{stats.totalMemories}}) ===

Core Knowledge ({{stats.coreCount}} entries):
{{#each (first 3 core)}}
  • {{formatMemory this}}
{{else}}
  No core memories available.
{{/each}}

Recent Context ({{stats.workingCount}} entries):
{{#each (last 5 working)}}
  • {{formatMemory this}}
{{else}}
  No working memories available.
{{/each}}

Critical Information (Importance > 0.8):
{{#each (filterByImportance memories 0.8)}}
  • {{formatMemory this}}
{{else}}
  No critical information found.
{{/each}}
`;

// Get quick context summary
export const CONTEXT_TEMPLATE = `
Current Context:
{{#with (last 3 working)}}
  {{#each this}}
    • {{truncate content 100}}
  {{/each}}
{{/with}}
`;
