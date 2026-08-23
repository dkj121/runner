# Issue tracker: Local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are stored one per file at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`
- Issue numbering starts at `01`; never combine all tickets into one file
- Comments and conversation history are appended under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a file under `.scratch/<feature-slug>/`, creating the directory if needed.

## When a skill says "fetch the relevant ticket"

Read the referenced file. The user will normally provide its path or issue number.

## Wayfinding operations

Used by `/wayfinder`. Each effort has one map and one child file per ticket.

- Map: `.scratch/<effort>/map.md`
- Child ticket: `.scratch/<effort>/issues/NN-<slug>.md`
- `Type:` records `research`, `prototype`, `grilling`, or `task`
- `Status:` records `claimed` or `resolved`
- `Blocked by: NN, NN` records ticket dependencies
- The frontier is the first numbered open, unblocked, and unclaimed ticket
- Claim a ticket by setting `Status: claimed` before starting work
- Resolve it by adding an `## Answer`, setting `Status: resolved`, and recording the result in the map
