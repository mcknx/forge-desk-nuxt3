# 003 — Money in minor units, integers only

**Status:** Accepted · Aug 2026

## Context

The desk turns logged minutes into invoice lines. `0.1 + 0.2 !== 0.3` in IEEE 754, and an invoice that is
three cents off the timesheet is a support ticket, not a rounding curiosity.

## Decision

Every monetary value is an integer in minor units — `hourlyRateMinor`, `amountMinor`, `subtotalMinor`,
`taxMinor`, `totalMinor` — named with the `Minor` suffix so a bare `rate` in a diff is visibly suspect.
Tax is basis points (`taxRateBp`, 1200 = 12%), also integer.

Rounding happens **once**, at the end, in `minutesToMinor`. Rounding per entry and then summing is how a
total drifts from its own line items.

Formatting to a display string happens in exactly one place, `money()` in `utils/format.ts`. Nothing
divides by 100 inline.

## Cost

Every form that takes a rate has to convert major to minor on submit and back on load. That conversion is
commented at each site because an uncommented `* 100` reads like a bug.

## Revisit when

Multi-currency invoicing needs conversion at a point in time. That requires storing the rate used and its
timestamp on the invoice; the integer representation stays either way.
