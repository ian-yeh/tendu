# Tendo 

Tendo is an autonomous QA agent that tests your web app the way a person would.
You describe what should happen in plain English. Tendu opens a browser,
figures out how to do it, and tells you whether it worked.

No test scripts. No selectors. No maintenance.

### What it does 
You give Tendu a URL and a prompt like "add an item to the cart and check out".
It takes it from there, navigating, clicking, typing, scrolling, and at each
step, it looks at what's actually on the screen to decide what to do next. When
it's done, it tells you whether the flow succeeded or where it broke. It's less
like a test runner and more like a QA engineer who never gets tired.

### Why
Most E2E testing tools require you to write and maintain brittle scripts that
break every time your UI changes. Tendo describes intent, not implementation.
If your button moves, Tendo adapts. If your flow changes, you update one
sentence.

## Commands

### `tendo test <url> -p "<prompt>"`
The `test` command is the core of Tendo. Provide it with a starting URL and a plain English description of the flow you want to verify. Tendo will spin up a browser, execute the steps autonomously using visual perception, and report whether the flow succeeded or failed.

**Example:**
```bash
tendo test https://example-store.com -p "Add the first featured item to the cart and proceed to checkout"
```

### `tendo watch <url> -p "<prompt>"`
The `watch` command runs the same autonomous agent as `test`, but in **debug mode** — the browser is visible so you can watch the agent navigate, click, and type in real-time. Each step's screenshot is saved to disk for post-run review.

Use `watch` when you want to:
- **See what the agent sees** — observe the browser as each action is executed live.
- **Debug failing flows** — understand exactly where and why a test goes wrong.
- **Review step-by-step** — screenshots are saved to `./tendo-watch/` with a timestamped directory per run.

**Example:**
```bash
tendo watch https://todomvc.com -p "Add three todos and mark the first one complete"
```

**Output directory:**
```
tendo-watch/
  └─ 2026-04-30T02-10-00/
      ├─ step-1.jpg
      ├─ step-2.jpg
      ├─ step-3.jpg
      └─ summary.json
```

*built by* Ian Yeh
