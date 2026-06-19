# Aeden Bakes Phase-Gate Routine

Use this routine for every phase of the project.

## Goal

Keep each phase strict, testable, and auditable before we move on.

The standing agents for this routine are documented in [AGENT_ROSTER.md](/D:/Aeden%20Bakes/docs/AGENT_ROSTER.md).

## Phase Flow

1. Define the UI/UX target for the phase.
2. Implement the phase work.
3. Run the QC agent.
4. Run the Visual QA agent.
5. Run the advisor agent.
6. Apply the required fixes.
7. Re-run builds and tests.
8. Mark the phase done only after the gate is clean.

## Agent Responsibilities

- UI/UX designer agent: defines the target visual system, interaction pattern, and component language.
- Builder agent: implements the current phase.
- QC agent: validates the result and looks for regressions, bypasses, and failure modes.
- Visual QA agent: compares the result against the approved reference look and brand system.
- Advisor agent: turns QC findings into the best fix list and next-step guidance.

These agents are not optional extras. They are part of the build loop.

## Step 1: Implement Phase Work

- Start with the approved UI/UX target for the phase.
- Build only the scope for the current phase.
- Keep changes aligned to the product blueprint.
- Avoid leaking future-phase work into the current phase unless it is a required dependency.
- Preserve existing behavior unless the phase explicitly changes it.

## Step 2: Run QC Agent

- Send the finished phase to the QC agent.
- Ask it to review:
  - builds
  - tests
  - state machine rules
  - data integrity
  - offline behavior
  - approval logic
  - ERP sync
  - UI failure states
  - stress cases
- Treat any high-severity issue as a stop sign.
- If QC finds a critical issue, return to implementation before continuing.

## Step 3: Run Visual QA Agent

- Send the implementation to the Visual QA agent.
- Ask it to review:
  - color consistency
  - typography hierarchy
  - spacing rhythm
  - card shapes and shadows
  - mobile-first behavior
  - desktop scaling
  - empty states
  - brand fidelity
- Treat any major mismatch against the approved reference as a stop sign.

## Step 4: Run Advisor Agent

- Send the QC report to the advisor agent.
- Ask it to:
  - rank the fixes by impact
  - suggest the best product and technical corrections
  - close loopholes
  - improve the next-phase plan
  - propose better operational flows when needed
- If Advisor identifies a structural product risk, update the phase plan before closing the phase.

## Step 5: Apply Fixes

- Fix the highest-impact items first.
- Keep the changes small and specific.
- Do not make unrelated refactors while closing phase findings.
- If a fix affects the product plan, update the plan documentation too.

## Step 6: Re-Run Builds And Tests

- Re-run the builds for every affected app or service.
- Re-run the tests that cover the changed behavior.
- Re-check any failure modes that were part of the original audit.
- Do not mark the phase done until the build and test pass is clean.
- QC should be re-run after fixes if the fix touches business logic, state transitions, or sync behavior.
- Visual QA should be re-run after fixes if the fix touches layout, color, motion, or component treatment.

## Step 7: Mark The Phase Done

Only close a phase when all of these are true:

- the implementation matches the planned scope
- QC found no critical or high-severity unresolved issues
- advisor recommendations were addressed or explicitly deferred with reason
- builds pass
- tests pass
- the remaining risk is acceptable and documented

## Standard Outputs

Every completed phase should produce:

- implementation summary
- QC report
- advisor report
- fix list
- verification result
- remaining risks

## Escalation Rules

- Stop the phase if a critical workflow can be bypassed.
- Stop the phase if data can be lost silently.
- Stop the phase if offline replay can corrupt live state.
- Stop the phase if approval gates do not hold.
- Stop the phase if ERP sync is not traceable.

## Operating Principle

The app is a production-capacity and bakery-operations system, not a shopping app.
Every phase should make the system more deterministic, more auditable, and harder to misuse.
