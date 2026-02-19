import { NextRequest, NextResponse } from "next/server";

import { analyzeBenchmarkStrategyWithGemini } from "@/lib/gemini";

function normalizeIncomingUrl(
  raw: string | undefined,
  request: NextRequest,
): string | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  try {
    if (trimmed.startsWith("/")) {
      return new URL(trimmed, request.nextUrl.origin).toString();
    }
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(trimmed, request.nextUrl.origin).toString();
    } catch {
      return trimmed;
    }
  }
}

function readString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readFile(formData: FormData, key: string): File | undefined {
  const value = formData.get(key);
  if (!(value instanceof File)) {
    return undefined;
  }
  return value.size > 0 ? value : undefined;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const referenceImageFile = readFile(formData, "referenceImage");
    const referenceImageUrl = normalizeIncomingUrl(
      readString(formData, "referenceImageUrl"),
      request,
    );
    const productName = readString(formData, "productName");
    const targetCustomer = readString(formData, "targetCustomer");
    const usp = readString(formData, "usp");
    const problem = readString(formData, "problem");
    const imageRatio = readString(formData, "imageRatio");
    const width = parseNumber(readString(formData, "width"), 1080);
    const height = parseNumber(readString(formData, "height"), 1080);

    if (!referenceImageFile && !referenceImageUrl) {
      return NextResponse.json(
        { error: "referenceImage or referenceImageUrl is required." },
        { status: 400 },
      );
    }

    const analysis = await analyzeBenchmarkStrategyWithGemini({
      referenceImageFile,
      referenceImageUrl,
      productName,
      targetCustomer,
      usp,
      problem,
      imageRatio,
      width,
      height,
    });

    return NextResponse.json({ analysis }, { status: 200 });
  } catch (error) {
    console.error("[/api/analyze] failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
