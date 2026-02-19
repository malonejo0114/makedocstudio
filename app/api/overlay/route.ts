import { NextRequest, NextResponse } from "next/server";

import { LayoutSchema } from "@/lib/layoutSchema";
import { renderGuideOverlayPngBase64 } from "@/lib/overlayExport";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = LayoutSchema.safeParse(body?.layout ?? body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid layout JSON." },
        { status: 400 },
      );
    }

    const showSafeZone = Boolean(body?.showSafeZone);
    const png = await renderGuideOverlayPngBase64(parsed.data, { showSafeZone });

    return NextResponse.json(
      {
        mimeType: png.mimeType,
        imageBase64: png.base64,
        dataUrl: png.dataUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[/api/overlay] failed:", error);
    return NextResponse.json(
      { error: "Overlay generation failed." },
      { status: 500 },
    );
  }
}

