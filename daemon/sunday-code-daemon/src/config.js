import 'dotenv/config'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function optional(name, fallback) {
  return process.env[name] ?? fallback
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  userId: required('SUNDAY_USER_ID'),
  claudeBin: optional('CLAUDE_CODE_BIN', 'claude'),
  pollIntervalMs: Number(optional('SUNDAY_POLL_INTERVAL_MS', '4000')),
  chatPollIntervalMs: Number(optional('SUNDAY_CHAT_POLL_INTERVAL_MS', '5000')),
  timezone: optional('SUNDAY_USER_TIMEZONE', 'America/Chicago'),
  homeAssistantUrl: optional('HOME_ASSISTANT_URL', ''),
  homeAssistantToken: optional('HOME_ASSISTANT_TOKEN', ''),
  githubToken: optional('GITHUB_TOKEN', ''),
  githubCloneBase: optional('GITHUB_CLONE_BASE', `${process.env.HOME ?? ''}/WebstormProjects`),
  githubSyncIntervalMs: Number(optional('SUNDAY_GITHUB_SYNC_INTERVAL_MS', String(15 * 60 * 1000))),
  mcpConfigPath: optional('SUNDAY_MCP_CONFIG_PATH', join(ROOT, 'sunday-mcp-config.json')),
  mcpServerPath: optional('SUNDAY_MCP_SERVER_PATH', join(HERE, 'mcp-server.js')),
  synthesisHourLocal: Number(optional('SUNDAY_SYNTHESIS_HOUR_LOCAL', '23')),
  rootDir: ROOT,
}

export function assertClaudeBinExists() {
  if (config.claudeBin.includes('/')) {
    if (!existsSync(config.claudeBin)) {
      throw new Error(`CLAUDE_CODE_BIN does not exist at path: ${config.claudeBin}`)
    }
  }
}
