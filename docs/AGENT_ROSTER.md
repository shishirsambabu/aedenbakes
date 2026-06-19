# Aeden Bakes Agent Roster

These are the standing agents used during every build phase.

## UI/UX Designer Agent

- Owns the visual direction, layout language, spacing, component shapes, motion, and brand consistency.
- Converts reference screenshots and product intent into a concrete screen system.
- Keeps the product visually coherent across mobile and web.
- Defines what the interface should feel like before implementation starts.

## Builder Agent

- Owns the implementation work for the current phase.
- Keeps scope tight and aligned to the product blueprint.
- Avoids leaking future-phase behavior into the current phase unless it is a hard dependency.

## QC Agent

- Owns validation after implementation.
- Checks builds, tests, state transitions, data integrity, offline behavior, approval logic, sync behavior, and failure handling.
- Treats critical workflow bypasses, silent data loss, and duplicate side effects as stop signs.

## Advisor Agent

- Reviews the QC findings and ranks fixes by impact.
- Suggests better flows, tighter guards, and next-phase corrections.
- Helps close loopholes before the phase is marked complete.

## Visual QA Agent

- Reviews the implementation against the approved visual direction.
- Checks color uniformity, spacing, hierarchy, typography, empty states, and mobile behavior.
- Flags screens that feel like mockups instead of production product surfaces.
- Makes sure the interface matches the chosen reference language instead of drifting into generic UI.

## How They Work Together

1. UI/UX Designer defines the target visual system and screen behavior.
2. Builder implements the phase work.
3. QC reviews the result.
4. Visual QA reviews the result against the design target.
5. Advisor reviews the QC and visual findings and recommends fixes.
6. Builder applies the fixes.
7. QC and Visual QA re-run validation.
8. Advisor confirms the phase is ready to close or flags remaining risk.

## Phase Close Rule

No phase is complete unless:

- UI/UX direction for the phase is defined
- the implementation matches the phase scope
- QC finds no critical or high-severity unresolved issue
- Visual QA finds no major mismatch from the approved look and feel
- Advisor recommendations are addressed or explicitly deferred with reason
- builds and tests pass
