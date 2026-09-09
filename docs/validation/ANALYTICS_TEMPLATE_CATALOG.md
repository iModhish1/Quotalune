# Quotalis analytics template catalog

| Template | Question / compatible metric | Evidence required | UI / fallback |
|---|---|---|---|
| Precision time series | How did one physical quota window change? quotaUsed | Valid timestamped account/window points | Trend Intelligence; break gaps/resets; compact unavailable state |
| Comparative time series | How does observed state compare with an equal prior period? quotaComparison | Existing comparison eligibility; same identity/grain and coverage | Current solid / previous dashed, original timestamps; reason when unsupported |
| Small multiples | How do independent providers' quota states differ over time? quotaUsed | 4–8 distinct provider series, common 0–100 scale/time domain | Expand Provider trend atlas; named scope per plot, no aggregate |
| Limit instrument | What is available now? quotaUsed/quotaRemaining | Ready valid physical window | Precision dial / compact / dual / rail, secondary windows and real reset; unavailable |
| Reset horizon | Which provider windows reset next? nextReset | Real future reset instants | Linear LTR timeline, close markers on lanes, agenda and full table; no invented reset |
| Provider comparison matrix | Which provider needs operational attention? independent current metrics | Current validated provider model | Headless sortable/column-selectable table, unknowns last |
| Coverage heatmap | Where are there observed captures? historySamples | Valid account/window timestamped capture counts | Time × physical series; blank means no observations, never known zero |
| Ranked analytics table | Which comparable rows rank highest? typed sortable metrics | Explicit units and compatible columns | Sticky headers, bounded pagination, null-last sorting; no arbitrary quota sums |
| Distribution/share | What fraction of a proven additive total belongs to each source? | No such quota denominator is proven here | Intentionally unavailable; registry exposes no quota-share template |
| Attention rail | What should be addressed? attentionCount / categorical incidents | Deterministic existing attention model | Auth/failure/quota/stale/reset/gap reasons and provider action; explicit no-attention state |

Template choices are constrained by Metric Registry. Precision/Minimal/Detailed adjust annotations/grid, not readings. Low CPU suppresses optional details; High Fidelity adds a real observed peak. Canvas is not an exposed user chart type. Visual zoom never changes metric period. Changing density, theme, template or identity cannot alter a value.
