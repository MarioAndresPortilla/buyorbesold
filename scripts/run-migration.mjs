#!/usr/bin/env node
/**
 * One-shot migration runner. Executes a .sql file against Postgres
 * using the Neon WebSocket Client (supports multi-statement SQL
 * like psql, unlike the HTTP `neon()` driver).
 *
 * Usage:
 *   node --env-file=.env.local scripts/run-migration.mjs db/migrations/002_congress.sql
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-migration.mjs <path-to-sql>");
  process.exit(1);
}

const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("POSTGRES_URL not set in .env.local");
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), file), "utf8");
const client = new Client(url);

try {
  await client.connect();
  console.log(`Running ${file} against ${new URL(url).host}…`);
  const start = Date.now();
  await client.query(sql);
  console.log(`✓ Migration complete in ${Date.now() - start}ms`);
} catch (err) {
  console.error("✗ Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
