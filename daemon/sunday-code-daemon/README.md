# sunday-code-daemon

A small Node process that drains the `sunday_code_queue` Supabase table by running Claude Code in the appropriate project on the local machine, streaming logs into `sunday_code_logs`.

## How it works

1. Sunday's `claude_code_dispatch` tool inserts a row into `sunday_code_queue` with `status: 'pending'`.
2. This daemon polls every few seconds for pending rows belonging to its configured user.
3. It atomically claims a row (`status` flips to `running`), looks up the project's `repo_path`, and spawns Claude Code:
   `claude --print --output-format stream-json --verbose < prompt`
4. Every line of stdout/stderr is persisted into `sunday_code_logs`.
5. On completion, the daemon writes a summary back to the queue row (`status: 'completed'` or `failed`).

No port is exposed. The daemon initiates all connections outbound to Supabase.

## Install

```bash
cd /Users/trentontaylor/WebstormProjects/taylorurl-com/daemon/sunday-code-daemon
npm install

# Configure secrets
cp .env.example .env   # then fill in
```

`.env` requires:

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key — keep this secret>
SUNDAY_USER_ID=<your admin auth.users.id>
CLAUDE_CODE_BIN=claude    # or absolute path
```

Verify it runs in the foreground first:

```bash
npm start
```

You should see `[sunday-daemon] starting — user_id=...` and `polling every 4000ms`.

## Run as a launchd service (auto-start on login)

```bash
cp launchd/com.trentontaylor.sunday-code-daemon.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.trentontaylor.sunday-code-daemon.plist
```

Logs land at `~/.sunday-code-daemon.out.log` and `~/.sunday-code-daemon.err.log`.

To stop / uninstall:

```bash
launchctl unload ~/Library/LaunchAgents/com.trentontaylor.sunday-code-daemon.plist
rm ~/Library/LaunchAgents/com.trentontaylor.sunday-code-daemon.plist
```
