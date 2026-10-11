"use client";

import { useState } from "react";
import { ChatUnavailable, requestFinish, requestTurn } from "@/lib/chat-client";
import { addDesign, applyFinish, buildDesign, CREATE_MESSAGE, rebuildDesign, replaceLatestDesign } from "@/lib/design";
import {
  addUserMessage, answeredTopics, applyExtraction, applyModelTurn, currentTopic, keywordExtract, nextStep, takeTurn, type Chip,
} from "@/lib/interview";
import { missingChoices } from "@/lib/recipe";
import { SAMPLES } from "@/lib/samples";
import { emptySession } from "@/lib/session";
import type { Phase, Profile, Session } from "@/lib/types";
import { useHydrated, useSession } from "@/lib/use-session";
import { Chat, type Notice } from "./chat";
import { RecipePanel } from "./recipe-panel";
import { ReviewForm } from "./review-form";

const STAGE_MS = 350; // the code stages after the model call are instant; pause so each is visible
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withPhase(session: Session, phase: Phase): Session {
  return { ...session, interview: { ...session.interview, phase } };
}

function Intro() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-3 pt-6 pb-4">
      <h2 className="font-serif text-4xl leading-tight sm:text-5xl">A pattern made from your story</h2>
      <p className="text-lg text-foreground/75">
        Share a place, a memory, or a feeling, and Common Threads composes a repeating textile pattern from an
        artist&apos;s original hand-drawn motifs.
      </p>
    </section>
  );
}

export default function Studio() {
  const hydrated = useHydrated();
  const [session, update] = useSession();
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState<number | null>(null);
  const [viewing, setViewing] = useState<string | null>(null); // message id of the open result card
  const [notice, setNotice] = useState<Notice | null>(null);
  const { phase } = session.interview;
  const sample = SAMPLES.find((s) => s.id === session.sampleId);

  const startOver = () => {
    const hasWork = session.messages.some((m) => m.role === "user") || session.profile.motifs || session.design;
    if (!hasWork || window.confirm("Start a new chat? Your current design will be cleared.")) {
      setNotice(null);
      setViewing(null);
      update(() => emptySession());
    }
  };

  // Each click loads the next sample, labelled in the review form.
  const trySample = () => {
    const next = SAMPLES[(SAMPLES.findIndex((s) => s.id === session.sampleId) + 1) % SAMPLES.length];
    update(() => ({ ...withPhase(emptySession(), "REVIEW"), profile: structuredClone(next.profile), sampleId: next.id }));
  };

  const changeProfile = (profile: Profile) => update((s) => ({ ...s, profile }));

  // Ask the model about the latest user message; if it is unavailable, read the
  // message with keyword matching instead and offer a retry.
  const answer = async (sent: Session, text: string, userId: string) => {
    const stillLatest = (s: Session) => s.messages.at(-1)?.id === userId;
    setPending(true);
    setNotice(null);
    try {
      const turn = await requestTurn(sent);
      update((s) => (stillLatest(s) ? applyModelTurn(s, turn, userId) : s));
    } catch (error) {
      update((s) => (stillLatest(s) ? applyExtraction(s, keywordExtract(text, currentTopic(sent)), userId) : s));
      const retry = () => {
        let reverted = false;
        update((s) => {
          if (s.messages.length !== sent.messages.length + 1 || s.messages.at(-2)?.id !== userId) return s;
          reverted = true;
          return sent;
        });
        if (reverted) void answer(sent, text, userId);
        else setNotice(null);
      };
      setNotice({ reason: error instanceof ChatUnavailable ? error.message : "error", onRetry: retry });
    } finally {
      setPending(false);
    }
  };

  const send = (text: string) => {
    let sent = session;
    let userId = "";
    update((s) => {
      [sent, userId] = addUserMessage(s, text);
      return sent;
    });
    void answer(sent, text, userId);
  };

  // Fixed chips (fallback only) set values directly, without a model call.
  const choose = (chip: Chip) => update((s) => takeTurn(s, chip.label, chip.extraction));
  const toReview = () => update((s) => withPhase(s, "REVIEW"));

  // Create pattern: the model suggests anything missing and names the pattern;
  // code builds it. Without the model, code names it; if a required choice is
  // still missing, the review form opens.
  const createPattern = async () => {
    if (pending || creating !== null) return;
    let sent = session;
    let userId = "";
    update((s) => {
      [sent, userId] = addUserMessage(withPhase(s, "INTERVIEW"), CREATE_MESSAGE);
      return sent;
    });
    setNotice(null);
    setCreating(0);

    let profile = sent.profile;
    let words: { name: string; description: string } | undefined;
    try {
      const finish = await requestFinish(sent);
      profile = applyFinish(sent.profile, finish.extraction, userId);
      words = finish;
    } catch (error) {
      setNotice({ reason: error instanceof ChatUnavailable ? error.message : "error" });
    }

    if (missingChoices(profile).length) {
      setCreating(null);
      update((s) => ({ ...withPhase(s, "REVIEW"), profile }));
      return;
    }
    const seed = SAMPLES.find((x) => x.id === sent.sampleId)?.seed ?? Math.floor(Math.random() * 1_000_000);
    const design = buildDesign(profile, seed, words);
    for (let stage = 1; stage < 5; stage++) {
      setCreating(stage);
      await sleep(STAGE_MS);
    }
    setCreating(null);
    update((s) => (s.messages.some((m) => m.id === userId) ? addDesign(s, profile, design) : s));
  };

  // A change in the View panel rebuilds the latest design with the same seed.
  const changeDesign = (profile: Profile) => {
    if (missingChoices(profile).length) return;
    update((s) => (s.design ? replaceLatestDesign(s, profile, rebuildDesign(s.design, profile)) : s));
  };

  const viewed = session.messages.find((m) => m.id === viewing)?.design;
  const latestCardId = session.messages.findLast((m) => m.design)?.id;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16">
      <header className="flex items-center justify-between gap-4 py-5">
        <h1 className="font-serif text-xl sm:text-2xl">Common Threads</h1>
        <nav className="flex gap-2 text-sm whitespace-nowrap">
          <button type="button" onClick={trySample} className="rounded-full border border-black/15 px-4 py-2 hover:bg-black/5">
            Try sample
          </button>
          <button type="button" onClick={startOver} className="rounded-full border border-black/15 px-4 py-2 hover:bg-black/5">
            New chat
          </button>
        </nav>
      </header>

      {!hydrated ? null : phase === "REVIEW" ? (
        <div className="flex flex-col gap-3">
          <ReviewForm profile={session.profile} sampleName={sample?.name} onChange={changeProfile} onCreate={createPattern} />
          <button
            type="button"
            onClick={() => update((s) => withPhase(s, "INTERVIEW"))}
            className="self-start text-sm text-foreground/60 underline underline-offset-4"
          >
            Back to the chat
          </button>
        </div>
      ) : (
        <>
          <Intro />
          <Chat
            messages={session.messages}
            pending={pending}
            creating={creating}
            notice={notice}
            canCreate={answeredTopics(session.profile).length > 0 || !!session.design}
            ready={nextStep(session).kind === "ready"}
            hasDesign={!!session.design}
            onSend={send}
            onChip={choose}
            onCreate={createPattern}
            onView={setViewing}
            onSkipToChoices={toReview}
          />
        </>
      )}

      {hydrated && viewed && (
        <RecipePanel
          design={viewed}
          profile={session.profile}
          editable={viewing === latestCardId}
          onChange={changeDesign}
          onChangeChoices={() => {
            setViewing(null);
            toReview();
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
