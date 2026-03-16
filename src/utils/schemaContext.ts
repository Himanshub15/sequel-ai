import type { DatabaseSchema } from "../types";

export function buildSchemaContext(schema: DatabaseSchema): string {
  const lines: string[] = [
    `Database: ${schema.database}`,
    `Tables:`,
  ];

  for (const table of schema.tables) {
    lines.push(`  ${table.tableName} (${table.columns.join(", ")})`);
  }

  return lines.join("\n");
}

export function buildSystemPrompt(
  schema: DatabaseSchema,
  dbType: string
): string {
  const dialect = dbType === "postgres" ? "PostgreSQL" : "MySQL";
  const schemaText = buildSchemaContext(schema);

  return [
    `You are a SQL assistant for a ${dialect} database.`,
    `When writing SQL, use ${dialect} syntax.`,
    `Here is the database schema:`,
    ``,
    schemaText,
    ``,
    `Guidelines:`,
    `- Write correct ${dialect} SQL`,
    `- Put SQL in \`\`\`sql code blocks`,
    `- Be concise but helpful`,
    `- If the user asks about the schema, refer to the tables and columns above`,
  ].join("\n");
}

export function buildSystemPromptFromMd(
  markdown: string,
  dbType: string
): string {
  const dialect = dbType === "postgres" ? "PostgreSQL" : "MySQL";

  return [
    `You are a SQL assistant for a ${dialect} database.`,
    `When writing SQL, use ${dialect} syntax.`,
    ``,
    `Here is the complete database schema documentation:`,
    ``,
    markdown,
    ``,
    `Guidelines:`,
    `- Write correct ${dialect} SQL`,
    `- Put SQL in \`\`\`sql code blocks`,
    `- Be concise but helpful`,
    `- Use the schema documentation above to understand tables, columns, types, indexes, relationships, and sample data`,
    `- When the user asks about the schema, provide accurate information from the documentation`,
  ].join("\n");
}
