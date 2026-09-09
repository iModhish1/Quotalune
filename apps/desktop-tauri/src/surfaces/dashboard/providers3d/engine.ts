/**
 * Phase 5: the imperative Three.js engine for the 3D Provider Universe
 * prototype.
 *
 * Explicit lifecycle (owner section 40): `createProvidersUniverseEngine`
 * (create + context-availability check) -> `mount` -> `resize` /
 * `updateData` / `updateTheme` / `updatePerformancePreset` -> `dispose`.
 * React never re-creates the renderer/scene on every snapshot update --
 * `ProvidersUniverseScene.tsx` holds ONE engine instance for the
 * component's lifetime and calls `updateData`/`updateTheme` on it.
 *
 * Rendering is event-driven (`DirtyRenderScheduler` from
 * `renderPolicy.ts`) -- there is no `requestAnimationFrame(loop)` running
 * forever. A frame is scheduled only by: mount (first paint), resize,
 * `updateData`, `updateTheme`, and OrbitControls' own `change` event
 * (camera interaction) or `end` event (finished interacting).
 *
 * `createProvidersUniverseEngine` never throws -- it returns a
 * discriminated result so the caller can render the WebGL-unavailable
 * fallback (owner section 41/42/70) instead of crashing the Dashboard.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { DashboardPerformancePreset } from "../../../types/bridge";
import type { ProviderSceneNode, SceneStructureColors } from "./sceneModel";
import {
  computeProviderLayout,
  primaryRingRadiusFor,
  ringForProvider,
  type ProviderRing,
  PRIMARY_RING_CAPACITY,
  SECONDARY_RING_RADIUS,
} from "./layout";
import { computeDevicePixelRatio, DirtyRenderScheduler, cameraTransitionDurationMs } from "./renderPolicy";
import { shouldShowLabel } from "./labelPolicy";
import { getCachedGlyphImage } from "./glyphCache";
import { isResetSoon } from "./resetProximity";

export interface EngineCallbacks {
  onSelect?: (id: string | null) => void;
  onHover?: (id: string | null) => void;
}

/**
 * Phase 5.1 owner section 6/23: lifecycle/demand-render instrumentation
 * for native (CDP-driven) proof passes.
 *
 * Note on gating: `import.meta.env.DEV` is Vite's *build-mode* flag
 * (`vite dev` vs `vite build`) -- it is `false` in every artifact this
 * project ships, including a `dev-channel`-feature Rust build, because
 * the frontend is always produced via `pnpm run build` regardless of the
 * Rust `dev-channel` Cargo feature (a completely separate axis: data-root
 * isolation from Personal, not frontend bundle mode). Gating this on
 * `import.meta.env.DEV` would make it permanently inert in the one binary
 * (`QuotalisDev.exe`) it exists to help verify. It is therefore always
 * registered -- but it is deliberately inert in cost and content: one
 * `Set.add`/`Set.delete` per engine lifecycle, no user data, no PII, no
 * behavior change (mirrors Three.js's own always-on `renderer.info`
 * counters, which this reads from). Never referenced by any production
 * rendering/business logic.
 */
declare global {
  interface Window {
    __quotalisProviders3DDebug__?: {
      engines: Set<ProvidersUniverseEngine>;
    };
  }
}

function debugRegistry(): NonNullable<Window["__quotalisProviders3DDebug__"]> | undefined {
  if (typeof window === "undefined") return undefined;
  if (!window.__quotalisProviders3DDebug__) {
    window.__quotalisProviders3DDebug__ = { engines: new Set() };
  }
  return window.__quotalisProviders3DDebug__;
}

export interface EngineOptions extends EngineCallbacks {
  performancePreset: DashboardPerformancePreset;
  reducedMotion: boolean;
}

export type CreateEngineResult =
  | { ok: true; engine: ProvidersUniverseEngine }
  | { ok: false; reason: "context-unavailable" | "init-failed"; error?: unknown };

/**
 * Phase 6 semantic material/scale constants -- a small, deliberately
 * restrained palette ("Structural Obsidian", "Smoked Metal", "Antique
 * Accent") rather than a unique material per provider (owner section
 * 18). Provider bodies stay metallic (`metalness`/`roughness` tuned for
 * a machined, smoked-metal read rather than the earlier flat matte
 * plastic) with only color/opacity/emissive varying per provider.
 */
const PROVIDER_BODY_RADIUS = 0.55;
const CORE_RADIUS = 1.0;
const CORE_HUB_RADIUS = CORE_RADIUS * 0.62;
const RING_INNER = PROVIDER_BODY_RADIUS + 0.15;
const RING_OUTER = RING_INNER + 0.18;
const SELECTION_RING_INNER = RING_OUTER + 0.06;
const SELECTION_RING_OUTER = SELECTION_RING_INNER + 0.05;
const PROVIDER_METALNESS = 0.55;
const PROVIDER_ROUGHNESS = 0.38;
/** Small, deterministic per-provider depth variation (owner section 16:
 *  "controlled Z variation... not so much that providers hide behind
 *  each other") -- a pure hash of the provider id, never `Math.random`,
 *  so the same provider always sits at the same height. */
const DEPTH_JITTER_RANGE = 0.35;
/** Owner section 8: a low-cost reset-proximity marker -- a small static
 *  dot at a fixed point on a provider's usage ring, shown only when its
 *  `resetsAt` falls within the same "reset soon" window the 2D
 *  dashboard's own alerts already use (`RESET_SOON_MS`). One shared
 *  geometry/material for every provider (never per-provider), toggled
 *  via `.visible` exactly like the selection ring -- no continuous
 *  animation, no per-frame cost. */
const RESET_MARKER_RADIUS = 0.09;
const RESET_MARKER_ANGLE = -Math.PI / 2;
const RESET_MARKER_ORBIT_RADIUS = (RING_INNER + RING_OUTER) / 2;

function hashUnitInterval(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

interface ProviderVisual {
  group: THREE.Group;
  body: THREE.Mesh;
  bodyMaterial: THREE.MeshStandardMaterial;
  usageRing: THREE.Mesh;
  usageRingMaterial: THREE.MeshBasicMaterial;
  /** Owner section 9 (required): the previously-missing in-canvas
   *  selection highlight -- a slightly larger ring than the usage ring,
   *  toggled via `.visible` (never recreated), so selecting/deselecting
   *  costs one dirty render, not a geometry rebuild. */
  selectionRing: THREE.Mesh;
  selectionRingMaterial: THREE.MeshBasicMaterial;
  /** Owner section 8: reset-proximity marker -- shares its geometry and
   *  material with every other provider's (created once on the engine,
   *  not per visual); only this mesh instance and its `.visible` are
   *  per-provider. */
  resetMarker: THREE.Mesh;
  /** Owner section 22/58 (Phase 5.2) label, now carrying an actual
   *  provider glyph (owner section 6) in addition to the short name --
   *  see `glyphCache.ts`. A `THREE.Sprite` always faces the camera. */
  label: THREE.Sprite;
  labelMaterial: THREE.SpriteMaterial;
  labelTexture: THREE.CanvasTexture;
  labelCanvas: HTMLCanvasElement;
  lastNode: ProviderSceneNode | null;
  lastIsSelected: boolean;
  lastIsHovered: boolean;
}

const LABEL_CANVAS_WIDTH = 256;
const LABEL_CANVAS_HEIGHT = 96;
const LABEL_GLYPH_SIZE = 56;

/** Renders a provider glyph (when its cached image has finished
 *  decoding -- see `glyphCache.ts`) plus a short name onto a small
 *  offscreen canvas used as a sprite texture. Redrawn (not recreated)
 *  whenever the provider's name/dim/glyph-readiness state changes -- one
 *  canvas/texture per provider for its whole lifetime, never per frame. */
function drawLabelTexture(
  canvas: HTMLCanvasElement,
  text: string,
  dim: boolean,
  glyph: HTMLImageElement | null,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const alpha = dim ? 0.55 : 0.95;

  let textY = canvas.height / 2;
  if (glyph && glyph.naturalWidth > 0 && glyph.naturalHeight > 0) {
    const aspect = glyph.naturalWidth / glyph.naturalHeight;
    const h = LABEL_GLYPH_SIZE;
    const w = h * aspect;
    ctx.globalAlpha = alpha;
    ctx.drawImage(glyph, (canvas.width - w) / 2, 4, w, h);
    ctx.globalAlpha = 1;
    textY = 4 + LABEL_GLYPH_SIZE + 22;
  }

  ctx.font = "600 30px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgba(232,234,237,${alpha})`;
  ctx.fillText(text, canvas.width / 2, textY, canvas.width - 16);
}

/**
 * Attempts to create a WebGL2 context and construct the engine. Never
 * throws -- any failure (no WebGL2 support, driver/init failure) returns
 * `{ ok: false }` instead.
 */
export function createProvidersUniverseEngine(
  canvas: HTMLCanvasElement,
  options: EngineOptions,
): CreateEngineResult {
  try {
    const context = canvas.getContext("webgl2", { antialias: true, alpha: false });
    if (!context) {
      return { ok: false, reason: "context-unavailable" };
    }
    const engine = new ProvidersUniverseEngine(canvas, context, options);
    return { ok: true, engine };
  } catch (error) {
    return { ok: false, reason: "init-failed", error };
  }
}

export class ProvidersUniverseEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  /** Owner section 4: the core redesigned as a small instrument hub plus
   *  two thin concentric "calibration ring" torii, rather than one plain
   *  glowing sphere -- reads as a navigation/calibration instrument, not
   *  a sun or a logo mark. All three meshes share the scene for the
   *  engine's whole lifetime (never recreated per frame or per theme
   *  change -- only their materials' colors update). */
  private readonly core: THREE.Mesh;
  private readonly coreMaterial: THREE.MeshStandardMaterial;
  private readonly coreRingInner: THREE.Mesh;
  private readonly coreRingOuter: THREE.Mesh;
  private readonly coreRingMaterial: THREE.MeshStandardMaterial;
  private readonly ambientLight: THREE.AmbientLight;
  private readonly keyLight: THREE.DirectionalLight;
  /** Owner section 17: a soft rim light from behind/below so provider
   *  bodies and the core get a machined-metal edge highlight instead of
   *  reading as flat matte shapes lit from one side only. */
  private readonly rimLight: THREE.DirectionalLight;
  /** Owner section 20: a small number of static background points --
   *  "faint static stellar points", never animated (no continuous frame
   *  cost) and disposed with everything else. */
  private readonly starfield: THREE.Points;
  private readonly starfieldMaterial: THREE.PointsMaterial;
  /** Owner section 15: thin orbit-guide torii, one per occupied ring,
   *  updated (never recreated) as the provider count changes which
   *  rings exist and what radius the primary ring uses. */
  private readonly primaryOrbitTrack: THREE.Mesh;
  private readonly secondaryOrbitTrack: THREE.Mesh;
  private readonly orbitTrackMaterial: THREE.MeshBasicMaterial;
  /** Owner section 8: one shared geometry/material for every provider's
   *  reset-proximity marker -- never recreated per provider. */
  private readonly resetMarkerGeometry: THREE.SphereGeometry;
  private readonly resetMarkerMaterial: THREE.MeshBasicMaterial;
  private readonly scheduler: DirtyRenderScheduler;
  private readonly providerVisuals = new Map<string, ProviderVisual>();
  private readonly canvas: HTMLCanvasElement;
  private options: EngineOptions;
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private disposed = false;
  private lastNodeIds: string[] = [];

  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
  };
  private readonly onContextRestored = () => {
    this.contextLost = false;
    this.scheduler.requestRender();
  };
  private contextLost = false;

  constructor(canvas: HTMLCanvasElement, context: WebGL2RenderingContext, options: EngineOptions) {
    this.canvas = canvas;
    this.options = options;
    debugRegistry()?.engines.add(this);
    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
    this.renderer.setPixelRatio(computeDevicePixelRatio(window.devicePixelRatio, options.performancePreset));

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 7, 11);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = !options.reducedMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 22;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.minPolarAngle = Math.PI * 0.05;
    this.controls.target.set(0, 0, 0);
    // Bounded orbit/pan/zoom (owner section 21): no upside-down flip, no
    // zooming inside geometry, and the polar-angle bound above keeps the
    // camera from ever looking from directly underneath.
    this.controls.addEventListener("change", () => this.scheduler.requestRender());

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
    this.keyLight.position.set(5, 8, 6);
    this.rimLight = new THREE.DirectionalLight(0xffffff, 0.45);
    this.rimLight.position.set(-6, -2, -7);
    this.scene.add(this.ambientLight, this.keyLight, this.rimLight);

    // Instrument hub -- smaller and more metallic than the old
    // full-size glowing icosahedron, so it reads as a precision core
    // rather than a sun (owner section 4).
    this.coreMaterial = new THREE.MeshStandardMaterial({ metalness: 0.6, roughness: 0.32 });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(CORE_HUB_RADIUS, 1), this.coreMaterial);
    // Two thin concentric calibration rings around the hub -- a quiet
    // "precision dial" detail, not decorative animation (they never
    // rotate on their own).
    this.coreRingMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.7,
      roughness: 0.4,
      transparent: true,
      opacity: 0.85,
    });
    this.coreRingInner = new THREE.Mesh(
      new THREE.TorusGeometry(CORE_RADIUS * 0.92, 0.012, 8, 64),
      this.coreRingMaterial,
    );
    this.coreRingInner.rotation.x = Math.PI / 2;
    this.coreRingOuter = new THREE.Mesh(
      new THREE.TorusGeometry(CORE_RADIUS * 1.18, 0.01, 8, 64),
      this.coreRingMaterial,
    );
    this.coreRingOuter.rotation.x = Math.PI / 2.4;
    this.scene.add(this.core, this.coreRingInner, this.coreRingOuter);

    // Owner section 15: subtle orbit-guide tracks -- structure, not
    // decoration. Created once at a placeholder radius; `updateData`
    // resizes/shows/hides them to match the real occupied ring(s).
    this.orbitTrackMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    });
    this.primaryOrbitTrack = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.006, 6, 96),
      this.orbitTrackMaterial,
    );
    this.primaryOrbitTrack.rotation.x = Math.PI / 2;
    this.primaryOrbitTrack.visible = false;
    this.secondaryOrbitTrack = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.006, 6, 96),
      this.orbitTrackMaterial,
    );
    this.secondaryOrbitTrack.rotation.x = Math.PI / 2;
    this.secondaryOrbitTrack.visible = false;
    this.scene.add(this.primaryOrbitTrack, this.secondaryOrbitTrack);

    // Owner section 8: shared reset-proximity marker geometry/material --
    // a small, fixed amber dot instanced (via separate Mesh objects, not
    // InstancedMesh -- provider counts here are far too small to need
    // it) once per provider, never a unique geometry/material per body.
    this.resetMarkerGeometry = new THREE.SphereGeometry(RESET_MARKER_RADIUS, 12, 8);
    // `depthTest: false` + a high `renderOrder` (set per-mesh below,
    // matching the selection ring's own treatment) so this small marker
    // never gets partially swallowed by the provider body it sits next
    // to at some camera angles -- it's a UI-ish indicator, not a real
    // occluding object.
    this.resetMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xe0a83f, depthTest: false });

    // Owner section 20: a small, fully static starfield -- positions are
    // generated once (deterministic hash-based spread, never
    // `Math.random`) and never animated, so it costs nothing at idle.
    const starCount = 220;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const a = hashUnitInterval(`star-a-${i}`) * Math.PI * 2;
      const b = hashUnitInterval(`star-b-${i}`) * Math.PI - Math.PI / 2;
      const r = 26 + hashUnitInterval(`star-r-${i}`) * 14;
      starPositions[i * 3] = Math.cos(a) * Math.cos(b) * r;
      starPositions[i * 3 + 1] = Math.sin(b) * r * 0.6;
      starPositions[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    this.starfieldMaterial = new THREE.PointsMaterial({
      size: 0.045,
      transparent: true,
      opacity: 0.5,
      color: 0xffffff,
      sizeAttenuation: true,
    });
    this.starfield = new THREE.Points(starGeometry, this.starfieldMaterial);
    this.scene.add(this.starfield);

    this.scheduler = new DirtyRenderScheduler(
      (cb) => requestAnimationFrame(cb),
      (handle) => cancelAnimationFrame(handle),
      () => this.renderFrame(),
    );

    canvas.addEventListener("webglcontextlost", this.onContextLost, false);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored, false);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
  }

  /** First paint after mount -- callers invoke this once the canvas has a
   *  real size. */
  mount(width: number, height: number): void {
    this.resize(width, height);
    this.scheduler.requestRender();
  }

  resize(width: number, height: number): void {
    if (this.disposed || width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.scheduler.requestRender();
  }

  updatePerformancePreset(preset: DashboardPerformancePreset): void {
    this.options = { ...this.options, performancePreset: preset };
    this.renderer.setPixelRatio(computeDevicePixelRatio(window.devicePixelRatio, preset));
    this.scheduler.requestRender();
  }

  updateReducedMotion(reducedMotion: boolean): void {
    this.options = { ...this.options, reducedMotion };
    this.controls.enableDamping = !reducedMotion;
    this.scheduler.requestRender();
  }

  updateTheme(colors: SceneStructureColors): void {
    this.renderer.setClearColor(new THREE.Color(colors.chamberBg[0]), 1);
    this.coreMaterial.color = new THREE.Color(colors.core);
    // Owner section 4 fix: the baseline capture showed the core nearly
    // invisible because `core` and `chamberBg` are close in value by
    // design (an intentionally subtle Obsidian material) -- a much
    // stronger emissive edge (was 0.15) makes it read as a real anchor
    // without turning it into a glowing sun.
    this.coreMaterial.emissive = new THREE.Color(colors.coreEdge);
    this.coreMaterial.emissiveIntensity = 0.55;
    // `colors.hairline` is always an rgba() CSS string (theme catalog
    // convention) -- not something `THREE.Color` should parse the alpha
    // channel out of, so the calibration rings use the real resolved
    // accent color instead, matching the core's own emissive edge.
    this.coreRingMaterial.color = new THREE.Color(colors.accent);
    this.coreRingMaterial.emissive = new THREE.Color(colors.accent);
    this.coreRingMaterial.emissiveIntensity = 0.25;
    this.orbitTrackMaterial.color = new THREE.Color(colors.accent);
    this.keyLight.color = new THREE.Color(colors.accent);
    this.scheduler.requestRender();
  }

  /** Diffs the incoming node list against the currently-tracked
   *  providers -- creates visuals for new ids, updates existing ones in
   *  place (never re-creating geometry/materials for an unchanged
   *  provider), and disposes visuals for ids no longer present. */
  updateData(nodes: readonly ProviderSceneNode[]): void {
    if (this.disposed) return;
    const ids = nodes.map((n) => n.id);
    const layout = computeProviderLayout(ids);

    const incomingIds = new Set(ids);
    for (const [id, visual] of this.providerVisuals) {
      if (!incomingIds.has(id)) {
        this.disposeProviderVisual(visual);
        this.providerVisuals.delete(id);
      }
    }

    for (const node of nodes) {
      let visual = this.providerVisuals.get(node.id);
      if (!visual) {
        visual = this.createProviderVisual();
        this.providerVisuals.set(node.id, visual);
        this.scene.add(visual.group);
      }
      this.applyNodeToVisual(visual, node, layout.get(node.id), ids);
    }

    this.lastNodeIds = ids;
    this.updateOrbitTracks(ids.length);
    this.frameCamera(ids.length);
    this.scheduler.requestRender();
  }

  /** Owner section 15: resizes/shows/hides the two orbit-guide torii to
   *  match whichever ring(s) are actually occupied -- never a decorative
   *  fixed-size ring unrelated to the real layout `layout.ts` computed. */
  private updateOrbitTracks(count: number): void {
    if (count <= 1) {
      this.primaryOrbitTrack.visible = false;
      this.secondaryOrbitTrack.visible = false;
      return;
    }
    const primaryCount = Math.min(count, PRIMARY_RING_CAPACITY);
    const primaryRadius = primaryRingRadiusFor(primaryCount);
    this.primaryOrbitTrack.geometry.dispose();
    this.primaryOrbitTrack.geometry = new THREE.TorusGeometry(primaryRadius, 0.006, 6, 96);
    this.primaryOrbitTrack.visible = true;

    const hasSecondary = count > PRIMARY_RING_CAPACITY;
    if (hasSecondary) {
      this.secondaryOrbitTrack.geometry.dispose();
      this.secondaryOrbitTrack.geometry = new THREE.TorusGeometry(SECONDARY_RING_RADIUS, 0.006, 6, 96);
    }
    this.secondaryOrbitTrack.visible = hasSecondary;
  }

  select(id: string | null): void {
    if (this.selectedId === id) return;
    const previous = this.selectedId;
    this.selectedId = id;
    this.options.onSelect?.(id);
    // Refresh both the just-deselected and just-selected visuals
    // immediately -- selection state must not wait for the next
    // `updateData()` pass (owner section 9/23).
    this.refreshVisualHighlight(previous);
    this.refreshVisualHighlight(id);
    this.scheduler.requestRender();
  }

  /** Re-applies the label/selection-ring/hover-emissive state for one
   *  provider id using its own last-known node -- a no-op if that
   *  provider isn't currently tracked (e.g. it was just deselected while
   *  no longer present in the scene). */
  private refreshVisualHighlight(id: string | null): void {
    if (!id) return;
    const visual = this.providerVisuals.get(id);
    if (!visual || !visual.lastNode) return;
    const ring = ringForProvider(id, this.lastNodeIds);
    this.updateLabelAndHighlight(visual, ring, this.lastNodeIds.length);
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  /** Bounded, deterministic camera reset -- frames the current provider
   *  set (owner section 21: "default camera should frame the active
   *  provider set automatically"). */
  resetView(): void {
    this.frameCamera(this.lastNodeIds.length, true);
    this.scheduler.requestRender();
  }

  private frameCamera(providerCount: number, force = false): void {
    if (!force && providerCount === this.lastFramedCount) return;
    this.lastFramedCount = providerCount;
    // Phase 5.1 owner sections 9/26 fix: the first native capture showed
    // 2 real providers looking like debris lost in a huge empty canvas --
    // the camera distance was a fixed bucket that assumed every count up
    // to 12 used the same full-size ring. It now derives from the same
    // real ring radius `layout.ts` actually places bodies on, so framing
    // tracks the true geometry instead of guessing at it a second time.
    let distance: number;
    if (providerCount <= 1) {
      distance = 6;
    } else {
      const primaryCount = Math.min(providerCount, PRIMARY_RING_CAPACITY);
      const hasSecondaryRing = providerCount > PRIMARY_RING_CAPACITY;
      const maxRingRadius = hasSecondaryRing ? SECONDARY_RING_RADIUS : primaryRingRadiusFor(primaryCount);
      distance = maxRingRadius * 1.7 + 4;
    }
    const duration = cameraTransitionDurationMs(this.options.reducedMotion);
    // Prototype: an interruptible transition would tween position over
    // `duration`; for the prototype we snap when reduced motion is on
    // and otherwise still snap but note the intended duration for a
    // production tween (owner section 22/78 -- cinematic easing is an
    // explicit non-goal this phase).
    void duration;
    this.camera.position.set(0, distance * 0.6, distance);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private lastFramedCount = -1;

  private createProviderVisual(): ProviderVisual {
    const group = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      metalness: PROVIDER_METALNESS,
      roughness: PROVIDER_ROUGHNESS,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(PROVIDER_BODY_RADIUS, 28, 20), bodyMaterial);
    const usageRingMaterial = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const usageRing = new THREE.Mesh(
      new THREE.RingGeometry(RING_INNER, RING_OUTER, 48, 1, 0, Math.PI * 2),
      usageRingMaterial,
    );
    usageRing.rotation.x = -Math.PI / 2;

    // Owner section 9 (required): the selection highlight -- a slightly
    // larger, thinner ring than the usage ring, hidden by default and
    // toggled via `.visible` in `applyNodeToVisual`. Never scaled/pulsed
    // continuously -- a static highlight, shown or hidden, costs exactly
    // one dirty render either way.
    const selectionRingMaterial = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    const selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(SELECTION_RING_INNER, SELECTION_RING_OUTER, 48),
      selectionRingMaterial,
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.visible = false;
    selectionRing.renderOrder = 5;

    const resetMarker = new THREE.Mesh(this.resetMarkerGeometry, this.resetMarkerMaterial);
    resetMarker.position.set(
      Math.cos(RESET_MARKER_ANGLE) * RESET_MARKER_ORBIT_RADIUS,
      0,
      Math.sin(RESET_MARKER_ANGLE) * RESET_MARKER_ORBIT_RADIUS,
    );
    resetMarker.visible = false;
    resetMarker.renderOrder = 6;

    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = LABEL_CANVAS_WIDTH;
    labelCanvas.height = LABEL_CANVAS_HEIGHT;
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMaterial = new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true,
      depthTest: false,
    });
    const label = new THREE.Sprite(labelMaterial);
    label.scale.set(1.3, 1.3 * (LABEL_CANVAS_HEIGHT / LABEL_CANVAS_WIDTH), 1);
    label.position.set(0, PROVIDER_BODY_RADIUS + 0.55, 0);
    // Rendered after the body/ring (renderOrder + depthTest:false) so the
    // label never gets z-fighting-clipped by a nearby provider's own
    // geometry -- it's a UI-ish overlay, not a real occluding 3D object.
    label.renderOrder = 10;

    group.add(body, usageRing, selectionRing, resetMarker, label);
    body.userData.pickable = true;
    return {
      group,
      body,
      bodyMaterial,
      usageRing,
      usageRingMaterial,
      selectionRing,
      selectionRingMaterial,
      resetMarker,
      label,
      labelMaterial,
      labelTexture,
      labelCanvas,
      lastNode: null,
      lastIsSelected: false,
      lastIsHovered: false,
    };
  }

  private applyNodeToVisual(
    visual: ProviderVisual,
    node: ProviderSceneNode,
    position: { x: number; y: number; z: number } | undefined,
    allIds: string[],
  ): void {
    // Owner section 16: a small, deterministic per-provider height
    // offset -- enough to break the "flat ring of icons" read without
    // ever hiding one body behind another or behind the core (bounded
    // to +/-DEPTH_JITTER_RANGE, far less than the body radius).
    const depthJitter = (hashUnitInterval(`depth:${node.id}`) - 0.5) * 2 * DEPTH_JITTER_RANGE;
    if (position) visual.group.position.set(position.x, depthJitter, position.z);
    visual.group.userData.providerId = node.id;
    visual.body.userData.providerId = node.id;
    visual.lastNode = node;

    const color = new THREE.Color(node.identityColorHex);
    visual.bodyMaterial.color = color;
    visual.bodyMaterial.emissive = color;
    // Dimmed body for a disconnected/auth-required provider (owner
    // section 33) -- semantic state, not a dramatic flash.
    visual.bodyMaterial.opacity = node.authState === "ready" ? 1 : 0.45;
    visual.bodyMaterial.transparent = node.authState !== "ready";

    const ring = ringForProvider(node.id, allIds);
    const scale = ring === "secondary" ? 0.75 : 1;
    visual.group.scale.setScalar(scale);

    // Ring arc = usage% (owner section 13: every encoding has a semantic
    // reason) -- a full circle at 100%, a sliver near 0%, never a
    // decorative random arc.
    const usedFraction = (node.usedPercent ?? 0) / 100;
    visual.usageRing.geometry.dispose();
    visual.usageRing.geometry = new THREE.RingGeometry(
      RING_INNER,
      RING_OUTER,
      48,
      1,
      -Math.PI / 2,
      Math.max(0.001, usedFraction * Math.PI * 2),
    );
    visual.usageRingMaterial.color = new THREE.Color(
      node.alertLevel === "critical" ? "#e0435a" : node.alertLevel === "warning" ? "#e0a83f" : node.identityColorHex,
    );
    visual.selectionRingMaterial.color = new THREE.Color(node.identityColorHex);

    // Owner section 8: reset-proximity marker -- same "reset soon"
    // definition as the 2D dashboard's own alerts (`RESET_SOON_MS`),
    // computed once here (not per frame) from the real `resetsAt`.
    visual.resetMarker.visible = isResetSoon(node.resetsAt);

    this.updateLabelAndHighlight(visual, ring, allIds.length);
  }

  /** Redraws the label (glyph + short name, owner sections 6/22) and
   *  refreshes the selection-ring/hover-emissive state for one provider
   *  visual, using its own last-known node/ring so this can be called
   *  independently of a full `updateData()` pass -- selecting or
   *  hovering a provider must update visuals immediately without
   *  waiting for the next data refresh. */
  private updateLabelAndHighlight(visual: ProviderVisual, ring: ProviderRing, count: number): void {
    const node = visual.lastNode;
    if (!node) return;
    const isSelected = node.id === this.selectedId;
    const isHovered = node.id === this.hoveredId;
    visual.lastIsSelected = isSelected;
    visual.lastIsHovered = isHovered;

    // Owner section 9 (required) / 10: selection is a persistent
    // structural ring; hover is a lighter emissive-only preview that
    // must never look stronger than selection. Both are static
    // show/hide + color-set operations -- no continuous animation.
    visual.selectionRing.visible = isSelected;
    visual.bodyMaterial.emissiveIntensity = isSelected ? 0.3 : isHovered ? 0.15 : 0;

    const showLabel = shouldShowLabel(count, ring, isSelected, isHovered);
    visual.label.visible = showLabel;
    if (showLabel) {
      const shortLabel = node.displayName.length > 12 ? `${node.displayName.slice(0, 11)}…` : node.displayName;
      const glyph = getCachedGlyphImage(node.id, node.identityColorHex, () => {
        // Fires once, the first time this exact (provider, color) glyph
        // finishes decoding -- redraw just this label and request one
        // more dirty frame; never a polling loop (owner section 6).
        if (this.disposed) return;
        this.updateLabelAndHighlight(visual, ring, count);
        this.scheduler.requestRender();
      });
      drawLabelTexture(visual.labelCanvas, shortLabel, node.authState !== "ready", glyph);
      visual.labelTexture.needsUpdate = true;
    }
  }

  private disposeProviderVisual(visual: ProviderVisual): void {
    this.scene.remove(visual.group);
    visual.body.geometry.dispose();
    visual.bodyMaterial.dispose();
    visual.usageRing.geometry.dispose();
    visual.usageRingMaterial.dispose();
    visual.selectionRing.geometry.dispose();
    visual.selectionRingMaterial.dispose();
    visual.labelTexture.dispose();
    visual.labelMaterial.dispose();
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const hitId = this.pickProviderId();
    if (hitId !== this.hoveredId) {
      const previous = this.hoveredId;
      this.hoveredId = hitId;
      this.options.onHover?.(hitId);
      // Cancel the stale hover's visual immediately (owner section 10)
      // and apply the new one -- hover does not move the camera (owner
      // section 22/24), only a cheap material/label update, so this
      // stays a single dirty render, never a transition.
      this.refreshVisualHighlight(previous);
      this.refreshVisualHighlight(hitId);
      this.scheduler.requestRender();
    }
  }

  private handlePointerDown(event: PointerEvent): void {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const hitId = this.pickProviderId();
    if (hitId) this.select(hitId);
  }

  private pickProviderId(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const bodies = Array.from(this.providerVisuals.values()).map((v) => v.body);
    const hits = this.raycaster.intersectObjects(bodies, false);
    if (hits.length === 0) return null;
    return (hits[0].object.userData.providerId as string) ?? null;
  }

  private renderFrame(): void {
    if (this.disposed || this.contextLost) return;
    this.renderer.render(this.scene, this.camera);
  }

  /** Diagnostic snapshot (Phase 5.1 owner section 6/23) for native proof
   *  passes -- `renderer.info.render.frame` is Three.js's own
   *  monotonically-increasing count of real `render()` calls made by
   *  this renderer instance across its lifetime; reading it here (rather
   *  than reimplementing a counter) is the demand-render proof: sample
   *  it, wait with no interaction, sample again, and confirm it did not
   *  advance. Not used by any production code path. */
  getDebugInfo() {
    return {
      disposed: this.disposed,
      schedulerScheduled: this.scheduler.isScheduled(),
      providerVisualCount: this.providerVisuals.size,
      rendererInfo: {
        frame: this.renderer.info.render.frame,
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
      },
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    debugRegistry()?.engines.delete(this);
    this.scheduler.dispose();
    this.controls.dispose();
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    for (const visual of this.providerVisuals.values()) this.disposeProviderVisual(visual);
    this.providerVisuals.clear();
    this.core.geometry.dispose();
    this.coreMaterial.dispose();
    this.coreRingInner.geometry.dispose();
    this.coreRingOuter.geometry.dispose();
    this.coreRingMaterial.dispose();
    this.primaryOrbitTrack.geometry.dispose();
    this.secondaryOrbitTrack.geometry.dispose();
    this.orbitTrackMaterial.dispose();
    this.starfield.geometry.dispose();
    this.starfieldMaterial.dispose();
    this.resetMarkerGeometry.dispose();
    this.resetMarkerMaterial.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
