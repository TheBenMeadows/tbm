/* Tool and agent names the site's own prose never uses: /ai and /news report
 * outcomes, not what produced them. Matched on word boundaries, so a venue
 * called OpenAgents survives while a stray "agent" does not. Used by
 * scripts/check-ai-wins.mjs and scripts/build-news.mjs. */
export const NAMES = [
    "orrery", "lathe", "claude", "anthropic", "openai", "chatgpt", "gpt",
    "gemini", "deepseek", "devin", "codex", "copilot", "cursor", "llama",
    "kimi", "grok", "qwen", "sonnet", "opus", "haiku", "fable",
    "agent", "agents", "bot", "llm", "ai",
];
export const NAME_PATTERN = new RegExp(`\\b(${NAMES.join("|")})\\b`, "i");
