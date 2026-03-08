type PromptTemplateValues = Record<string, string | number | boolean | null | undefined>;

const promptTokenPattern = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderPrompt(template: string, values: PromptTemplateValues): string {
  return template.replace(promptTokenPattern, (_match, token: string) => {
    const value = values[token];

    return value === undefined || value === null ? '' : String(value);
  });
}
