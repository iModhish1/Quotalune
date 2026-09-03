# V4_REFERENCE_COMPARISON — craftsmanship vs TrackNotch

Compared against `.local/research/tracknotch` source + reference imagery (local-only).
Scores are craftsmanship-only, V4 current state:

| Axis | TrackNotch | QuotaArc V4 | Notes |
|---|---|---|---|
| Shape | 9 | 8.5 | NotchShape quad-curl translated to housingPath; side anchors (right spine) curl less elegantly than top |
| Anchoring | 9.5 | 8.5 | TrackNotch owns a hardware notch; QuotaArc synthesizes the taskbar seam — credible but needs the real-desktop pass |
| Provider identity | 9 | 8.5 | glyph-in-ring both; TrackNotch icons read slightly larger |
| Arc quality | 8 (dots/levels) | 9 | QuotaArc's origin-notch + endpoint-dot arc is more instrument-like |
| Animation | 9 | 7.5 | choreography engine exists; SwiftUI-native spring feel not yet matched in WebView |
| Density | 9 | 8.5 | expanded quadrants match; taskbar wing spacing close |
| Typography | 8.5 | 8.5 | parity (tabular, hierarchy) |
| Material | 9 | 8 | their pure-black + glow border is deeper; V4 graphite needs the energy-edge pass |
| Depth | 9 | 8 | same — energy edge + ambient provider reflection pending |
| Originality | 8 | 9 | Edge spine + taskbar seam anchoring are Windows-specific and ours |
| Premium feel | 9 | 8.3 | motion polish gap is the remaining delta |

Verdict: gap is now concentrated in MOTION polish (spring tuning + energy edge) and side-anchor
curl quality — not in layout or identity. Those are the next pass.
