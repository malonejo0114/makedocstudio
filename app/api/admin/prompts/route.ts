import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

const UpdateSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9._-]+\.md$/),
  content: z.string().min(1),
});

function normalizeFilename(raw: string) {
  const filename = raw.trim();
  if (!/^[a-zA-Z0-9._-]+\.md$/.test(filename)) {
    throw new Error("허용되지 않는 파일명입니다.");
  }
  return filename;
}

async function listPromptFiles() {
  const entries = await fs.readdir(PROMPTS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filenameQuery = searchParams.get("filename");

    if (filenameQuery) {
      const filename = normalizeFilename(filenameQuery);
      const filePath = path.join(PROMPTS_DIR, filename);
      const [content, stat] = await Promise.all([
        fs.readFile(filePath, "utf8"),
        fs.stat(filePath),
      ]);

      return NextResponse.json(
        {
          item: {
            filename,
            content,
            updatedAt: stat.mtime.toISOString(),
          },
        },
        { status: 200 },
      );
    }

    const files = await listPromptFiles();
    const items = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(PROMPTS_DIR, filename);
        const [content, stat] = await Promise.all([
          fs.readFile(filePath, "utf8"),
          fs.stat(filePath),
        ]);
        return {
          filename,
          content,
          updatedAt: stat.mtime.toISOString(),
        };
      }),
    );

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "프롬프트 목록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const parsed = UpdateSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "프롬프트 수정 요청 형식이 올바르지 않습니다.",
          detail: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const filename = normalizeFilename(parsed.data.filename);
    const filePath = path.join(PROMPTS_DIR, filename);

    await fs.writeFile(filePath, parsed.data.content, "utf8");
    const stat = await fs.stat(filePath);

    return NextResponse.json(
      {
        item: {
          filename,
          content: parsed.data.content,
          updatedAt: stat.mtime.toISOString(),
        },
        message: "프롬프트를 저장했습니다.",
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "프롬프트 저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
