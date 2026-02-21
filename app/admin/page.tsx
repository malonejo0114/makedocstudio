import Link from "next/link";
import { cookies } from "next/headers";

import AdminPromptLab from "@/components/studio-ui/AdminPromptLab";
import AdminTemplatesManager from "@/components/studio-ui/AdminTemplatesManager";
import { getAdminCookieName } from "@/lib/adminSession";

async function logoutAction() {
  "use server";
  cookies().set({
    name: getAdminCookieName(),
    value: "",
    maxAge: 0,
    path: "/",
  });
}

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-20 pt-8">
      <section className="rounded-[32px] border border-black/10 bg-white p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Admin</p>
        <h1 className="mt-2 text-4xl font-semibold text-[#0B0B0C]">운영 콘솔</h1>
        <p className="mt-2 text-sm text-black/65">
          템플릿/프롬프트 관리, 분석-생성 미리보기 테스트를 한 화면에서 진행합니다.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/studio" className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/75">
            스튜디오
          </Link>
          <Link href="/templates" className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/75">
            템플릿 페이지
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
            >
              관리자 로그아웃
            </button>
          </form>
        </div>
      </section>

      <AdminPromptLab />
      <AdminTemplatesManager />
    </main>
  );
}
