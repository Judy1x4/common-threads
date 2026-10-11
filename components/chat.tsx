"use client";

import { useEffect, useRef, useState } from "react";
import { CREATE_STAGES } from "@/lib/design";
import { chipsFor, type Chip } from "@/lib/interview";
import { renderTile, svgDataUrl } from "@/lib/render";
import type { Design, Message } from "@/lib/types";
import { downloadDesign } from "./download";

export type Notice = { reason: string; onRetry?: () => void };

function SuggestionRows({ suggestions, onPick }: { suggestions: string[]; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {suggestions.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onPick(text)}
          className="rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-left hover:border-black/30"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function CreateButton({ emphasis, label, onClick }: { emphasis: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm ${emphasis ? "bg-foreground text-background hover:opacity-90" : "border border-black/15 bg-white/70 hover:border-black/30"}`}
    >
      ✦ {label}
    </button>
  );
}

// The real steps behind Create; the first waits on the model.
function Progress({ stage }: { stage: number }) {
  return (
    <ol className="flex flex-col gap-2" aria-label="Creating your pattern">
      {CREATE_STAGES.map((label, i) => (
        <li key={label} className={`flex items-center gap-3 ${i > stage ? "text-foreground/35" : ""}`}>
          {i < stage ? (
            <span className="w-4 text-center text-[#426451]">✓</span>
          ) : i === stage ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
          ) : (
            <span className="w-4 text-center">·</span>
          )}
          {label}
        </li>
      ))}
    </ol>
  );
}

// A result card in the chat: tile, name, description, View, and Download.
function DesignCard({ design, onView }: { design: Design; onView: () => void }) {
  const [downloading, setDownloading] = useState(false);
  return (
    <article className="flex max-w-xl flex-col gap-4 rounded-2xl border border-black/10 bg-white/70 p-4 sm:p-5">
      <div className="flex gap-4">
        {/* A data-URL image keeps the SVG's ids separate from the page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgDataUrl(renderTile(design.recipe, design.plan))} alt="" className="h-20 w-20 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h3 className="font-serif text-2xl">{design.name}</h3>
          <p className="line-clamp-3 text-sm text-foreground/70">{design.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onView} className="rounded-xl border border-black/15 bg-white px-4 py-2.5 hover:border-black/30">
          View
        </button>
        <button
          type="button"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            try {
              await downloadDesign(design);
            } finally {
              setDownloading(false);
            }
          }}
          className="rounded-xl bg-foreground px-4 py-2.5 text-background hover:opacity-90 disabled:opacity-50"
        >
          {downloading ? "Preparing…" : "Download"}
        </button>
      </div>
    </article>
  );
}

export function Chat({ messages, pending, creating, notice, canCreate, ready, hasDesign, onSend, onChip, onCreate, onView, onSkipToChoices }: {
  messages: Message[];
  pending: boolean;
  creating: number | null; // the active Create stage, or null
  notice: Notice | null;
  canCreate: boolean;
  ready: boolean;
  hasDesign: boolean;
  onSend: (text: string) => void;
  onChip: (chip: Chip) => void;
  onCreate: () => void;
  onView: (messageId: string) => void;
  onSkipToChoices: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const last = messages.at(-1);
  const opening = !messages.some((m) => m.role === "user");
  const busy = pending || creating !== null;
  const awaitingAnswer = !busy && last?.role === "assistant";
  const suggestions = awaitingAnswer ? (last.suggestions ?? []) : [];
  // Fixed chips only appear when the model was unavailable and the template asked.
  const chips = awaitingAnswer && !suggestions.length && last.topic ? chipsFor(last.topic) : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending, creating, revealedFor]);

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    onSend(text);
    setDraft("");
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
      <div className="flex flex-col gap-6 pb-4">
        {messages.map((m) =>
          m.design ? (
            <DesignCard key={m.id} design={m.design} onView={() => onView(m.id)} />
          ) : m.role === "user" ? (
            <p key={m.id} className="max-w-[85%] self-end rounded-2xl bg-black/[.06] px-4 py-2.5 text-lg">
              {m.text}
            </p>
          ) : (
            <p key={m.id} className="max-w-[95%] text-lg leading-relaxed sm:text-xl">
              {m.text}
            </p>
          ),
        )}

        {creating !== null && <Progress stage={creating} />}

        {pending && (
          <p className="flex gap-1.5 py-2" aria-label="Thinking">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </p>
        )}

        {awaitingAnswer && opening && suggestions.length > 0 && <SuggestionRows suggestions={suggestions} onPick={onSend} />}

        {awaitingAnswer && !opening && (
          <div className="flex flex-col gap-3">
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
            <div className="flex flex-wrap gap-2">
              {suggestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRevealedFor(revealedFor === last.id ? null : last.id)}
                  className="rounded-xl bg-black/[.05] px-4 py-2.5 text-sm hover:bg-black/[.08]"
                >
                  {revealedFor === last.id ? "Hide suggestions" : "Show suggestions"}
                </button>
              )}
              {canCreate && <CreateButton emphasis={ready && !hasDesign} label={hasDesign ? "Create another" : "Create pattern"} onClick={onCreate} />}
            </div>
            {revealedFor === last.id && suggestions.length > 0 && <SuggestionRows suggestions={suggestions} onPick={onSend} />}
          </div>
        )}

        {notice && (
          <p className="text-sm text-foreground/60">
            AI unavailable ({notice.reason}), so I&apos;m using simple replies.{" "}
            {notice.onRetry && (
              <button type="button" onClick={notice.onRetry} className="underline underline-offset-4">
                Retry
              </button>
            )}
          </p>
        )}
        {/* The margin keeps the latest message and suggestions clear of the sticky input bar. */}
        <div ref={endRef} className="scroll-mb-36" />
      </div>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-background/90 py-3 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 rounded-2xl bg-black/[.06] p-2 pl-4"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your message…"
            aria-label="Your message"
            maxLength={1000}
            className="min-w-0 flex-1 bg-transparent py-2 outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || busy}
            aria-label="Send"
            className="h-10 w-10 shrink-0 rounded-full bg-foreground text-lg text-background disabled:opacity-30"
          >
            →
          </button>
        </form>
        <button type="button" onClick={onSkipToChoices} className="self-start text-sm text-foreground/60 underline underline-offset-4">
          Skip the chat and choose directly
        </button>
      </div>
    </section>
  );
}
