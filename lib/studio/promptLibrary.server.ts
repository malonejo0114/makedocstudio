import fs from "node:fs/promises";
import path from "node:path";

import { getPromptOverride } from "@/lib/promptOverrides.server";

export async function loadStudioPromptTemplate(filename: string): Promise<string> {
  const key = filename.trim();
  if (!key) {
    throw new Error("Prompt template filename is required.");
  }

  const override = await getPromptOverride(key);
  if (override) {
    return override.content;
  }

  const filePath = path.join(process.cwd(), "prompts", key);
  const content = await fs.readFile(filePath, "utf8");
  return content;
}

export function fillStudioTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(variables)) {
    const token = `{{${key}}}`;
    const replacement = value === null || value === undefined ? "" : String(value);
    out = out.split(token).join(replacement);
  }
  return out.trim();
}
