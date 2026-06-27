"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_KEY = "vectisflows.auth";

export default function AiPromptPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const isAuthed = sessionStorage.getItem(AUTH_KEY) === "true";
    if (!isAuthed) router.replace("/login");
  }, [router]);

  async function onSubmit() {
  const trimmed = text.trim();
  if (!trimmed) return;
  setIsSubmitting(true);
  setStatus(null);
  const url = 'http://localhost:3000/api/v1/rfqs/parse';
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt:trimmed ,
      }),
    });
    
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Request failed (${res.status}) from ${url}${body ? `: ${body}` : ''}`);
    }
    
    const data = await res.json();
    const output = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    setStatus(output ? 'Submitted. Response received.' : 'Submitted. (No response text found)');
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Submission failed');
  } finally {
    setIsSubmitting(false);
  }
}


  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-zinc-900" />
            <div>
              <div className="text-sm font-semibold text-zinc-900">Vectisflows</div>
              <div className="text-xs text-zinc-500">AI Prompt</div>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            <a
              className="rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              href="/menu"
            >
              Back
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Prompt</h2>
          <p className="mt-1 text-sm text-zinc-600">Enter a paragraph and submit it to Google.</p>

          <div className="mt-5">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              className="w-full resize-y rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
              placeholder="Type your paragraph here..."
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || text.trim().length === 0}
              className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>

            {status ? <div className="text-sm text-zinc-700">{status}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}

