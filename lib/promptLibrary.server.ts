import fs from "node:fs/promises";
import path from "node:path";

export type PromptTemplateId = "background_only" | "full_creative";

const TEMPLATE_FILES: Record<PromptTemplateId, string> = {
  background_only: "background_only.md",
  full_creative: "full_creative.md",
};

const cache = new Map<PromptTemplateId, string>();

export function fillPromptTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(variables)) {
    const token = `{{${key}}}`;
    const replacement =
      value === null || value === undefined ? "" : String(value);
    out = out.split(token).join(replacement);
  }
  return out.trim();
}

export async function loadPromptTemplate(id: PromptTemplateId): Promise<string> {
  if (process.env.NODE_ENV !== "development") {
    const cached = cache.get(id);
    if (cached) return cached;
  }

  const filename = TEMPLATE_FILES[id];
  const filePath = path.join(process.cwd(), "prompts", filename);
  const content = await fs.readFile(filePath, "utf8");
  if (process.env.NODE_ENV !== "development") {
    cache.set(id, content);
  }
  return content;
}

