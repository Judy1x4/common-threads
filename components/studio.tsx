"use client";

import { currentTopic, keywordExtract, takeTurn, answeredTopics, type Chip } from "@/lib/interview";
import { profileToRecipe } from "@/lib/recipe";
import { buildRenderPlan } from "@/lib/render";
import { SAMPLES } from "@/lib/samples";
import { emptySession } from "@/lib/session";
import type { Phase, Profile, Session } from "@/lib/types";
import { useHydrated, useSession } from "@/lib/use-session";
import { Chat } from "./chat";
import { ResultView } from "./result-view";
import { ReviewForm } from "./review-form";

function withPhase(session: Session, phase: Phase): Session {
  return { ...session, interview: { ...session.interview, phase } };
}

function Intro() {
  return (
    <section className="flex max-w-2xl flex-col gap-3 pt-6 pb-4">
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
  const { phase } = session.interview;
  const sample = SAMPLES.find((s) => s.id === session.sampleId);

  const startOver = () => {
    const hasWork = session.messages.some((m) => m.role === "user") || session.profile.motifs || session.currentRecipe;
    if (!hasWork || window.confirm("Start a new chat? Your current design will be cleared.")) update(() => emptySession());
  };

  // Each click loads the next sample, labelled in the review form.
  const trySample = () => {
    const next = SAMPLES[(SAMPLES.findIndex((s) => s.id === session.sampleId) + 1) % SAMPLES.length];
    update(() => ({ ...withPhase(emptySession(), "REVIEW"), profile: structuredClone(next.profile), sampleId: next.id }));
  };

  const changeProfile = (profile: Profile) => update((s) => ({ ...s, profile }));

  // Step 5 reads answers with keyword matching; Step 6 puts the model call here.
  const send = (text: string) => update((s) => takeTurn(s, text, keywordExtract(text, currentTopic(s))));
  const choose = (chip: Chip) => update((s) => takeTurn(s, chip.label, chip.extraction));
  const toReview = () => update((s) => withPhase(s, "REVIEW"));

  const create = () =>
    update((s) => {
      const seed = SAMPLES.find((x) => x.id === s.sampleId)?.seed ?? Math.floor(Math.random() * 1_000_000);
      const recipe = profileToRecipe(s.profile, seed);
      return { ...withPhase(s, "RESULT"), previousRecipe: s.currentRecipe, currentRecipe: recipe, renderPlan: buildRenderPlan(recipe) };
    });

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

      {!hydrated ? null : phase === "RESULT" && session.currentRecipe && session.renderPlan ? (
        <ResultView
          profile={session.profile}
          recipe={session.currentRecipe}
          plan={session.renderPlan}
          onChangeChoices={() => update((s) => withPhase(s, "REVIEW"))}
        />
      ) : phase === "REVIEW" || phase === "RESULT" ? (
        <div className="flex flex-col gap-3">
          <ReviewForm profile={session.profile} sampleName={sample?.name} onChange={changeProfile} onCreate={create} />
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
            canCreate={answeredTopics(session.profile).length > 0}
            onSend={send}
            onChip={choose}
            onCreate={toReview}
            onSkipToChoices={toReview}
          />
        </>
      )}
    </div>
  );
}
