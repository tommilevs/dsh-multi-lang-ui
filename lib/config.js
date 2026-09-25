const DEFAULT_TYPOGRAPHY = Object.freeze({ enabled: false, yo: true, liveInput: false })

export function readConfigValue(config, key, fallback) {
  const field = config?.[key]
  const value = field && typeof field.get === 'function' ? field.get() : field
  return value === undefined ? fallback : value
}

export function readSettings(config) {
  return {
    enabled: readConfigValue(config, 'enabled', true),
    overrides: readConfigValue(config, 'overrides', {}),
    typography: readConfigValue(config, 'typography', DEFAULT_TYPOGRAPHY),
    agentPrompt: readConfigValue(config, 'agentPrompt', false),
    agentPromptPreset: readConfigValue(config, 'agentPromptPreset', 'technical_expert'),
    slashAliases: readConfigValue(config, 'slashAliases', false),
    quickSwitch: readConfigValue(config, 'quickSwitch', true),
    translateEngine: readConfigValue(config, 'translateEngine', 'off'),
    localApiUrl: readConfigValue(config, 'localApiUrl', 'http://127.0.0.1:5000')
  }
}
