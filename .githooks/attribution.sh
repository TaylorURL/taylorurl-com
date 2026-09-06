# The vendors and phrases .github/workflows/ci.yml refuses, kept here in the
# same shape so the two cannot drift into disagreeing about what attribution
# is. CI is the wall; these are the guard rail before it. If the wall moves,
# move this with it — scripts/check-attribution-guard.js fails when the two
# stop matching.

# An identity that names an AI vendor. A bare `[bot]` is deliberately not
# matched: dependabot writes no prose and is not what this is about.
AI_IDENTITY='anthropic|claude|openai|codex|copilot|windsurf|devin|bard|githubcopilot|cursor\.(sh|com)'

# Attribution in a message. Anchored on the trailer or the phrase rather than
# the bare vendor name, so a commit that discusses a vendor still lands.
AI_MESSAGE='co-?authored-?by:.*(claude|anthropic|codex|openai|copilot|gpt-|gemini|cursor|devin)'
AI_MESSAGE="$AI_MESSAGE"'|generated[[:space:]]+(with|by).*(claude|codex|openai|copilot|chatgpt)'
AI_MESSAGE="$AI_MESSAGE"'|(made|written|created|authored)[[:space:]]+(with|by)[[:space:]]+(claude|codex|chatgpt|copilot)'
AI_MESSAGE="$AI_MESSAGE"'|claude[-[:space:]]?session:|claude\.ai|anthropic\.com'
