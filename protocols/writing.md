# Writing Guide

These rules govern all prose written in this project: conversation replies,
GitHub issues and pull request text, commit messages, plans, handoffs,
session logs, README files, code comments and docstrings, and paper prose.
Write like an economist addressing a coauthor, not like a software engineer
or an AI assistant.

## The Audience Test

Use plain language or terminology standard in modern economics. A term fails
this test if an economics PhD would not understand it immediately from
ordinary research practice. Name the object or task directly. If a precise
software term is unavoidable, explain it in plain language in the same
sentence or comment. When unsure whether a term passes, rewrite it.

This test is the rule. The banned-vocabulary table below only records terms
that have already been ruled on; a term that fails the test must be
rewritten whether or not it appears in the table.

## Banned Programmer Vocabulary

Common offenders and their replacements -- not an exhaustive list; the
audience test governs. Never rename identifiers (file names, function
names, make targets, variables, column names) to satisfy this rule; when
prose must name an identifier, put the exact name in backticks.

| Avoid | Write instead (adapt to context) |
|---|---|
| ship / shipped | finish / merge / release |
| smoke test / smoke run | quick test / quick-check run |
| sanity check | basic check / quick check |
| preflight | setup check before running |
| harness | test routine / validation routine |
| fixture | example test data / test input |
| scaffold | initial structure |
| canonical / canon | main / standard / official / authoritative |
| legacy | earlier / older / superseded |
| contract (data-format sense) | required columns / expected structure |
| surface (as a verb) | find / turn up / reveal |
| gate (check sense) | check / threshold / requirement |
| schema | column layout / file structure |
| artifact (build-output sense) | output file |
| entrypoint / entry point | main command / top-level script |
| sidecar | companion file |
| payload | contents / stored outputs / data |
| no-op | no effect / nothing to rebuild |
| mock / stub (in prose) | placeholder / substitute |
| boilerplate | generic filler text / standard setup lines |
| sandbox | isolated test setup |
| sharded | split into pieces |
| hydrate | reload / rebuild in memory |
| orchestrate / orchestrator | run in order / main driver script |
| backfill | fill in missing ... |
| refactor (in prose) | reorganize / clean up |
| deprecated | superseded / retired |
| wire up / plumbing | connect / underlying setup |
| maintained (as a qualifier: maintained scenario, solver, algorithm) | the implemented algorithm / the scenario workflow / the default settings, or drop the word |

Acceptable without rewriting (explicitly ruled on): cache, wrapper, stale,
parse, dry run, upstream/downstream (including the input-output sense),
helper, manifest, source of truth, API, side effect, regex, hardcoded,
checksum, driver, runner, edge case, alias, fail fast, and surface as a
mathematical or physical noun (a criterion surface, surface temperature).
The verb ban on surface applies in code as well as prose: comments,
docstrings, and identifiers. Terms on neither
list get the audience test, not the benefit of the doubt.

After replacing a term, re-read the sentence and smooth it. The goal is
prose an economist reads naturally, not word swaps.

## AI-Inflated Vocabulary

Never use: delve, tapestry, landscape, realm, pivotal, seamless, plethora,
unlock, empower, transformative, paradigm shift, "in today's world", "there
has been growing interest in". Avoid filler transitions at paragraph
openings and motivational filler generally.

## Voice

- Use first person. In issues, pull request comments, and notes, write "I",
  not an authorial "we"; in paper prose, "we" refers to the authors.
- State what was verified plainly. Where something is unverified or
  uncertain, say so with "I think" or "as far as I can tell". Do not project
  confidence you do not have, and do not hedge routinely either -- one clear
  qualification beats scattered qualifiers.
- Prefer active voice and simple verbs: estimate, identify, show, find,
  compare, decompose, quantify.
- Lead with the result. Put units on numbers, dollar-years on dollar
  amounts, and a benchmark next to a headline magnitude when one exists.
- No promotional or press-release tone. No emojis.

## Structure

- Short documents and GitHub posts: flowing prose, or a plain bullet list
  when enumerating several parallel items. No section headers, and no bolded
  pseudo-headers such as "**Bottom line.**" or "**Findings.**".
- Conversation replies follow the same rules: answer first, plain language,
  minimal structure.
- When discussing results or a model, describe the economics and the
  mathematics -- with displayed equations where useful -- rather than code
  mechanics. Mention file paths, function names, or pipeline stages only
  when the code itself is the topic.
- Keep it short. Include what the reader needs to act or decide, and stop.

## Mechanics

- Hyphenate only compound adjectives before a noun ("standard errors", but
  "standard-error estimates").
- Define acronyms at first use.
- Comments and docstrings are self-contained: no issue numbers, commit
  hashes, or references to AI conversations.
- Commit messages in normal, human-authored language with no AI attribution.

## Related Rules

- Code comments and docstrings: `protocols/conventions/shared.md` (same banned
  list plus code-specific commenting rules).
- Paper and slide prose: `latex/AGENTS.md` TeX prose conventions; when
  drafting manuscript text, follow the ivan-voice register (first person,
  no contractions, active voice, magnitudes early with benchmarks).
