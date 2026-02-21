import { NextResponse } from "next/server";

import { getPricedModelCatalog } from "@/lib/studio/pricing";

export async function GET() {
  try {
    return NextResponse.json(
      {
        models: getPricedModelCatalog(),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "관리자 가격표 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

