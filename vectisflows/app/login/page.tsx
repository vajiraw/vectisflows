"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_KEY = "vectisflows.auth";
const USERNAME = "next";
const PASSWORD = "next";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && password.length > 0;
  }, [username, password]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (username === USERNAME && password === PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "true");
      router.push("/menu");
      return;
    }

    setError("Invalid username or password.");
  }

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center bg-zinc-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-zinc-900">Login</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Use <span className="font-mono">next</span> / <span className="font-mono">next</span>
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10 rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-900 focus:ring-0"
              autoComplete="username"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-900 focus:ring-0"
              autoComplete="current-password"
            />
          </label>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            Sign in
          </button>
        </div>
      </form>
    </div>
  );
}

