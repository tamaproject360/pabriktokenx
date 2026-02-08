/**
 * Generate a display label for a model that includes the provider prefix
 * This helps identify which provider a model belongs to when the same model name exists across providers
 */

const PROVIDER_PREFIXES: Record<string, string> = {
  'codex': 'Codex',
  'github-copilot': 'Copilot',
  'copilot': 'Copilot',
  'gemini': 'Gemini',
  'gemini-cli': 'Gemini CLI',
  'claude': 'Claude',
  'claude-code': 'Claude Code',
  'anthropic': 'Anthropic',
  'openai': 'OpenAI',
  'antigravity': 'Antigravity',
  'vertex': 'Vertex',
  'qwen': 'Qwen',
  'iflow': 'iFlow',
};

/**
 * Get the display prefix for a provider
 */
export function getProviderPrefix(provider: string): string {
  const lowerProvider = provider.toLowerCase();
  
  // Try exact match first
  if (PROVIDER_PREFIXES[lowerProvider]) {
    return PROVIDER_PREFIXES[lowerProvider];
  }
  
  // Try partial match
  for (const [key, value] of Object.entries(PROVIDER_PREFIXES)) {
    if (lowerProvider.includes(key)) {
      return value;
    }
  }
  
  // Capitalize first letter as fallback
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Generate a model label with provider prefix
 * @param modelName - The model display name or ID
 * @param provider - The provider type (e.g., 'codex', 'copilot', 'gemini')
 * @returns A formatted label like "Codex GPT 5" or "Copilot Claude Sonnet 4"
 */
export function getModelLabelWithProvider(modelName: string, provider: string): string {
  const prefix = getProviderPrefix(provider);
  
  // Check if the model name already starts with the provider prefix (case insensitive)
  if (modelName.toLowerCase().startsWith(prefix.toLowerCase())) {
    return modelName;
  }
  
  // Check for common patterns that already include provider info
  const modelLower = modelName.toLowerCase();
  const prefixLower = prefix.toLowerCase();
  
  // Don't duplicate if model already has the provider name in it
  if (modelLower.includes(prefixLower)) {
    return modelName;
  }
  
  return `${prefix} ${modelName}`;
}

/**
 * Format model ID to a readable name
 * @param modelId - The raw model ID like "gpt-5-codex" or "claude-sonnet-4"
 * @returns A formatted name like "GPT 5 Codex" or "Claude Sonnet 4"
 */
export function formatModelName(modelId: string): string {
  return modelId
    .split(/[-_]/)
    .map(word => {
      // Keep known acronyms uppercase
      const upperWords = ['gpt', 'ai', 'api', 'llm', 'xl', 'xxl'];
      if (upperWords.includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
