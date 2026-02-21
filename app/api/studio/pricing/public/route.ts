import { NextResponse } from "next/server";

import { getPublicPricedModelCatalog } from "@/lib/studio/pricing";

export async function GET() {
  try {
    return NextResponse.json(
      {
        models: getPublicPricedModelCatalog(),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "가격표 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

