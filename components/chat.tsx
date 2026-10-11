"use client";

import { useEffect, useRef, useState } from "react";
import { chipsFor, type Chip } from "@/lib/interview";
import type { Message } from "@/lib/types";

export function Chat({ messages, canCreate, onSend, onChip, onCreate, onSkipToChoices }: {
  messages: Message[];
  canCreate: boolean;
  onSend: (text: string) => void;
  onChip: (chip: Chip) => void;
  onCreate: () => void;
  onSkipToChoices: () => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const last = messages.at(-1);
  const chips = last?.role === "assistant" && last.topic ? chipsFor(last.topic) : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <section className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 pb-4">
        {messages.map((m) => (
          <p
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
              m.role === "user" ? "self-end bg-foreground text-background" : "self-start border border-black/10 bg-white/70"
            }`}
          >
            {m.text}
          </p>
        ))}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => onChip(chip)}
                className="flex items-center gap-2 rounded-full border border-black/15 bg-white/60 px-3 py-1.5 text-sm hover:border-black/40"
              >
                {chip.swatches && (
                  <span className="flex">
                    {chip.swatches.map((color) => (
                      <span key={color} className="-mr-1 h-4 w-4 rounded-full border border-white" style={{ background: color }} />
                    ))}
                  </span>
                )}
                {chip.label}
              </button>
            ))}
          </div>
        )}
        {/* The margin keeps the latest message and chips clear of the sticky input bar. */}
        <div ref={endRef} className="scroll-mb-36" />
      </div>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-background/90 py-3 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your answer…"
            aria-label="Your answer"
            className="min-w-0 flex-1 rounded-full border border-black/15 bg-white px-4 py-3"
          />
          <button type="submit" disabled={!draft.trim()} className="rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-30">
            Send
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {canCreate && (
            <button type="button" onClick={onCreate} className="font-medium underline underline-offset-4">
              Create pattern now
            </button>
          )}
          <button type="button" onClick={onSkipToChoices} className="text-foreground/60 underline underline-offset-4">
            Skip the chat and choose directly
          </button>
        </div>
      </div>
    </section>
  );
}
