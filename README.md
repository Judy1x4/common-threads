Hosted here! https://common-threads-sigma.vercel.app/

# Common Threads

A chatbot that creates a repeating textile pattern from a person's answers and original hand-drawn motifs.

See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) for the idea and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for how it is built.

## Run locally

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000 (pattern lab: /lab)
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app with hot reload |
| `npm run test:claude` | Check the API key and the structured profile extraction |
| `npm run test:chat` | Play sample conversations against Claude and check the replies (calls the API) |
| `npm run trace` | Trace the drawings in `assets/raw/` and regenerate `lib/motif-paths.ts` |
| `npm run render:samples` | Render the sample patterns as PNGs in `assets/samples/` (add `-- --edges` to mark tile edges) |
| `npm run check:interview` | Check the conversation logic (merge, next question, keywords, chips) |
| `npm run typecheck` | Generate Next.js route types and run TypeScript |
| `npm run lint` | Run ESLint |
| `npm run build` | Production build |
