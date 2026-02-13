#!/usr/bin/env node
// Extracts table:column pairs from prisma/schema.prisma
// Used by check-schema-sync.sh to compare against production DB

const fs = require('fs');
const path = require('path');

const schemaPath = process.argv[2] || path.join(__dirname, '..', 'prisma', 'schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');
const models = schema.split(/^model /m).slice(1);

for (const block of models) {
  const lines = block.split('\n');
  const mapLine = lines.find(l => l.trim().startsWith('@@map('));
  if (!mapLine) continue;
  const tableMatch = mapLine.match(/@@map\("([^"]+)"\)/);
  if (!tableMatch) continue;
  const table = tableMatch[1];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed === '}') continue;
    if (trimmed.includes('@relation')) continue;

    const parts = trimmed.split(/\s+/);
    const field = parts[0];
    const type = parts[1];
    if (!field || !type) continue;

    // Skip if field starts with uppercase
    if (field[0] >= 'A' && field[0] <= 'Z') continue;

    // Skip relation types — keep Prisma scalar types (String, Int, Boolean, etc.)
    const scalarTypes = new Set(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'BigInt', 'Decimal', 'Bytes']);
    const bareType = type.replace(/[?\[\]]/g, '');
    if (bareType[0] >= 'A' && bareType[0] <= 'Z' && !scalarTypes.has(bareType)) continue;
    // Skip array relations (e.g. Comment[])
    if (type.includes('[]')) continue;

    // Get column name from @map or convert camelCase to snake_case
    const mapMatch = trimmed.match(/@map\("([^"]+)"\)/);
    const col = mapMatch ? mapMatch[1] : field.replace(/[A-Z]/g, c => '_' + c.toLowerCase());

    console.log(table + ':' + col);
  }
}
