"use client";

import { CloudUpload } from "lucide-react";
import { useUserStore, selectUserName } from "@/app/store";

export default function DashboardHeader() {
  const userName = useUserStore(selectUserName);

  return (
    <header className="flex items-start justify-between gap-4 rounded-2xl px-6 py-5">
      <div>
        <h1 className="text-4xl font-semibold leading-tight text-white">
          Welcome back, {userName}
        </h1>
        <p className="mt-1 text-zinc-400">
          Your AI is currently processing 3 new viral clips from your last stream.
        </p>
      </div>

      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-xl bg-[#00E68A] px-5 py-3 text-sm font-semibold text-black shadow-[0_8px_24px_rgba(0,230,138,0.35)] transition hover:brightness-95"
      >
        <CloudUpload className="h-4 w-4" aria-hidden="true" />
        Quick Upload
      </button>
    </header>
  );
}