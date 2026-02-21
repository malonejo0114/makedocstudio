import fs from "node:fs/promises";
import path from "node:path";

import { getPromptOverride } from "@/lib/promptOverrides.server";

export type PromptTemplateId = "background_only" | "full_creative";

const TEMPLATE_FILES: Record<PromptTemplateId, string> = {
  background_only: "background_only.md",
  full_creative: "full_creative.md",
};

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
  const filename = TEMPLATE_FILES[id];
  const override = await getPromptOverride(filename);
  if (override) return override.content;

  const filePath = path.join(process.cwd(), "prompts", filename);
  const content = await fs.readFile(filePath, "utf8");
  return content;
}
