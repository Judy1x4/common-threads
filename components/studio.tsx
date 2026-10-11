"use client";

import { profileToRecipe } from "@/lib/recipe";
import { buildRenderPlan } from "@/lib/render";
import { SAMPLES } from "@/lib/samples";
import { emptySession } from "@/lib/session";
import type { Phase, Profile, Session } from "@/lib/types";
import { useHydrated, useSession } from "@/lib/use-session";
import { ResultView } from "./result-view";
import { ReviewForm } from "./review-form";

function withPhase(session: Session, phase: Phase): Session {
  return { ...session, interview: { ...session.interview, phase } };
}

// Step 4 start screen; the chat replaces it in Step 5.
function Intro({ onStart, onSample }: { onStart: () => void; onSample: () => void }) {
  return (
    <section className="flex max-w-2xl flex-col gap-6 py-10">
      <h2 className="font-serif text-5xl leading-tight">A pattern made from your story</h2>
      <p className="text-lg text-foreground/75">
        Share a place, a memory, or a feeling, choose shapes and colours, and Common Threads composes a repeating textile
        pattern from an artist&apos;s original hand-drawn motifs.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onStart} className="rounded-full bg-foreground px-6 py-3 text-background hover:opacity-90">
          Choose your design
        </button>
        <button type="button" onClick={onSample} className="rounded-full border border-black/15 px-6 py-3 hover:bg-black/5">
          Try a sample
        </button>
      </div>
    </section>
  );
}

export default function Studio() {
  const hydrated = useHydrated();
  const [session, update] = useSession();
  const { phase } = session.interview;
  const sample = SAMPLES.find((s) => s.id === session.sampleId);

  const startOver = () => {
    const hasWork = session.messages.length > 0 || session.profile.motifs || session.currentRecipe;
    if (!hasWork || window.confirm("Start a new chat? Your current design will be cleared.")) update(() => emptySession());
  };

  // Each click loads the next sample, labelled in the review form.
  const trySample = () => {
    const next = SAMPLES[(SAMPLES.findIndex((s) => s.id === session.sampleId) + 1) % SAMPLES.length];
    update(() => ({ ...withPhase(emptySession(), "REVIEW"), profile: structuredClone(next.profile), sampleId: next.id }));
  };

  const changeProfile = (profile: Profile) => update((s) => ({ ...s, profile }));

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
        <ReviewForm profile={session.profile} sampleName={sample?.name} onChange={changeProfile} onCreate={create} />
      ) : (
        <Intro onStart={() => update((s) => withPhase(s, "REVIEW"))} onSample={trySample} />
      )}
    </div>
  );
}
