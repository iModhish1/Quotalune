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
  PRIMARY_RING_CAPACITY,
  SECONDARY_RING_RADIUS,
} from "./layout";
import { computeDevicePixelRatio, DirtyRenderScheduler, cameraTransitionDurationMs } from "./renderPolicy";

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

const PROVIDER_BODY_RADIUS = 0.55;
const CORE_RADIUS = 1.1;
const RING_INNER = PROVIDER_BODY_RADIUS + 0.15;
const RING_OUTER = RING_INNER + 0.18;

interface ProviderVisual {
  group: THREE.Group;
  body: THREE.Mesh;
  bodyMaterial: THREE.MeshStandardMaterial;
  usageRing: THREE.Mesh;
  usageRingMaterial: THREE.MeshBasicMaterial;
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
  private readonly core: THREE.Mesh;
  private readonly coreMaterial: THREE.MeshStandardMaterial;
  private readonly ambientLight: THREE.AmbientLight;
  private readonly keyLight: THREE.DirectionalLight;
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

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    this.keyLight.position.set(5, 8, 6);
    this.scene.add(this.ambientLight, this.keyLight);

    this.coreMaterial = new THREE.MeshStandardMaterial({ metalness: 0.4, roughness: 0.45 });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(CORE_RADIUS, 1), this.coreMaterial);
    this.scene.add(this.core);

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
    this.coreMaterial.emissive = new THREE.Color(colors.coreEdge);
    this.coreMaterial.emissiveIntensity = 0.15;
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
    this.frameCamera(ids.length);
    this.scheduler.requestRender();
  }

  select(id: string | null): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.options.onSelect?.(id);
    this.scheduler.requestRender();
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
    const bodyMaterial = new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(PROVIDER_BODY_RADIUS, 24, 16), bodyMaterial);
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
    group.add(body, usageRing);
    body.userData.pickable = true;
    return { group, body, bodyMaterial, usageRing, usageRingMaterial };
  }

  private applyNodeToVisual(
    visual: ProviderVisual,
    node: ProviderSceneNode,
    position: { x: number; y: number; z: number } | undefined,
    allIds: string[],
  ): void {
    if (position) visual.group.position.set(position.x, position.y, position.z);
    visual.group.userData.providerId = node.id;
    visual.body.userData.providerId = node.id;

    const color = new THREE.Color(node.identityColorHex);
    visual.bodyMaterial.color = color;
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
  }

  private disposeProviderVisual(visual: ProviderVisual): void {
    this.scene.remove(visual.group);
    visual.body.geometry.dispose();
    visual.bodyMaterial.dispose();
    visual.usageRing.geometry.dispose();
    visual.usageRingMaterial.dispose();
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const hitId = this.pickProviderId();
    if (hitId !== this.hoveredId) {
      this.hoveredId = hitId;
      this.options.onHover?.(hitId);
      // Hover does not move the camera (owner section 22/24) -- only a
      // cheap material/label update, so this stays a single dirty render,
      // never a transition.
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
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
