"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const AUTH_KEY = "vectisflows.auth";

export default function MenuPage() {
  const router = useRouter();

  useEffect(() => {
    const isAuthed = sessionStorage.getItem(AUTH_KEY) === "true";
    if (!isAuthed) router.replace("/login");
  }, [router]);

  function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-zinc-900" />
            <div>
              <div className="text-sm font-semibold text-zinc-900">Vectisflows</div>
              <div className="text-xs text-zinc-500">Dashboard</div>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            <a
              className="rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              Home
            </a>
            <div className="relative">
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                onClick={(e) => e.preventDefault()}
              >
                Actions
              </button>
              <div className="absolute left-0 mt-1 w-44 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
                <a
                  href="/ai-prompt"
                  className="block rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push("/ai-prompt");
                  }}
                >
                  Prompt
                </a>
              </div>

            </div>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Logout
            </button>

          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Welcome</h2>
          <p className="mt-2 text-sm text-zinc-600">
            You are logged in. The credentials are hardcoded as <span className="font-mono">next</span> /
            <span className="font-mono">next</span>.
          </p>
        </div>
      </main>
    </div>
  );
}

