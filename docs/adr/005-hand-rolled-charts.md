# 005 — Hand-rolled SVG charts, no chart library

**Status:** Accepted · Aug 2026

## Context

The dashboard needs two charts: fourteen bars of daily logged minutes, and a donut of task status.
Chart.js is roughly 200KB before a wrapper; ECharts is larger. Both would be the heaviest thing in a
bundle whose entire point is being fast.

## Decision

Two components, `SparkBars.vue` and `DonutChart.vue`, drawing inline SVG. Bars are `<rect>` with a height
proportional to the max; the donut is `stroke-dasharray` arithmetic on concentric `<circle>` elements.
Together they are well under a hundred lines and add nothing to `package.json`.

Both carry `role="img"` and an `aria-label` stating the actual numbers. An SVG chart with no accessible
name is invisible to a screen reader, which makes it decoration rather than information.

## Cost

No axes, no zoom, no legends beyond what is written by hand, no tooltips beyond a `<title>`. Adding a
third chart type would mean writing a third component rather than passing a config object.

## Revisit when

There are more than three chart types, or one needs real interaction — brushing, zooming, live streaming.
At that point a library is doing work worth its weight.
