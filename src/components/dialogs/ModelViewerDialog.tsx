import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { X, Download } from "lucide-react";
import type { DashboardProject } from "../../types/scs";
import { useCanvasStore, type UvEdge } from "../../store/canvasStore";

export type ModelViewerPanelProps = {
  light: boolean;
  getDashboardSnapshot?: () => string | null;
  /** Current project — used to render the dashboard preview via the backend. */
  project?: DashboardProject | null;
  /** Active screen's numeric SCS id (e.g. 100) — passed to the render backend. */
  screenId?: number | null;
  /** Increment to clear the loaded 3D model (e.g. on "New Project"). */
  resetSignal?: number;
  /**
   * Invoked when the user clicks the "Canvas'ı modele uydur" button inside
   * the UV modal. The host is expected to open the project's canvas-size
   * dialog pre-filled with the provided aspect so the user can commit the
   * change through the undo/redo manager.
   */
  onRequestCanvasResize?: (suggestedAspect: number) => void;
};

function fitCameraToObject(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
): void {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const dist = maxDim * 1.5;
  camera.position.set(center.x, center.y, center.z + dist);
  controls.target.copy(center);
  controls.update();
  camera.updateProjectionMatrix();
}

/**
 * Walk a Three.js Object3D and collect every triangle edge in UV space.
 * Returned tuples are `[u0, v0, u1, v1]` with V=0 at the TOP of the texture
 * (DirectX / ZModeler convention). Raw, unwrapped values are returned so the
 * caller can detect tiling (values outside [0,1]).
 */
function extractUvEdges(model: THREE.Object3D): UvEdge[] {
  const edges: UvEdge[] = [];
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geo = child.geometry;
    const uvAttr = geo.attributes.uv as THREE.BufferAttribute | undefined;
    if (!uvAttr) return;

    const pushFace = (ia: number, ib: number, ic: number) => {
      const u = (i: number) => uvAttr.getX(i);
      const v = (i: number) => uvAttr.getY(i);
      edges.push([u(ia), v(ia), u(ib), v(ib)]);
      edges.push([u(ib), v(ib), u(ic), v(ic)]);
      edges.push([u(ic), v(ic), u(ia), v(ia)]);
    };

    if (geo.index) {
      const idx = geo.index.array;
      for (let i = 0; i < idx.length; i += 3) {
        pushFace(idx[i], idx[i + 1], idx[i + 2]);
      }
    } else {
      const count = uvAttr.count;
      for (let i = 0; i < count; i += 3) {
        pushFace(i, i + 1, i + 2);
      }
    }
  });
  return edges;
}

/** Axis-aligned bounding box over every UV endpoint (raw, unwrapped). */
function computeUvBounds(edges: UvEdge[]): {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
} | null {
  if (edges.length === 0) return null;
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [u0, v0, u1, v1] of edges) {
    if (u0 < minU) minU = u0;
    if (u0 > maxU) maxU = u0;
    if (u1 < minU) minU = u1;
    if (u1 > maxU) maxU = u1;
    if (v0 < minV) minV = v0;
    if (v0 > maxV) maxV = v0;
    if (v1 < minV) minV = v1;
    if (v1 > maxV) maxV = v1;
  }
  if (!isFinite(minU) || !isFinite(minV)) return null;
  return { minU, maxU, minV, maxV };
}

/**
 * Render the UV wireframe (already extracted) onto an offscreen canvas.
 * If `bgDataUrl` is provided it is drawn first as the dashboard background.
 * Returns a PNG data URL.
 */
async function renderUvWireframe(
  edges: UvEdge[],
  canvasW: number,
  canvasH: number,
  bgDataUrl: string | null,
  light: boolean,
): Promise<string> {
  const offscreen = document.createElement("canvas");
  offscreen.width = canvasW;
  offscreen.height = canvasH;
  const ctx = offscreen.getContext("2d")!;

  if (bgDataUrl) {
    await new Promise<void>((res) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvasW, canvasH);
        res();
      };
      img.onerror = () => res();
      img.src = bgDataUrl;
    });
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else {
    ctx.fillStyle = light ? "#f1f5f9" : "#0f172a";
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  if (edges.length === 0) {
    ctx.fillStyle = light ? "#64748b" : "#94a3b8";
    ctx.font = `${Math.round(canvasW / 30)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Bu modelde UV haritası bulunamadı.", canvasW / 2, canvasH / 2);
  } else {
    // Detect tiling: scan raw UV extents before wrapping
    let uvMinU = Infinity, uvMaxU = -Infinity;
    let uvMinV = Infinity, uvMaxV = -Infinity;
    for (const [u0, v0, u1, v1] of edges) {
      if (u0 < uvMinU) uvMinU = u0; if (u0 > uvMaxU) uvMaxU = u0;
      if (u1 < uvMinU) uvMinU = u1; if (u1 > uvMaxU) uvMaxU = u1;
      if (v0 < uvMinV) uvMinV = v0; if (v0 > uvMaxV) uvMaxV = v0;
      if (v1 < uvMinV) uvMinV = v1; if (v1 > uvMaxV) uvMaxV = v1;
    }
    const isTiled =
      uvMaxU > 1.001 || uvMaxV > 1.001 || uvMinU < -0.001 || uvMinV < -0.001;
    // Tile counts (for display)
    const tileU = Math.max(1, Math.round(uvMaxU - Math.min(0, uvMinU)));
    const tileV = Math.max(1, Math.round(uvMaxV - Math.min(0, uvMinV)));

    // frac(x) wraps any real number to [0, 1) — handles negative UV too
    const frac = (x: number) => ((x % 1) + 1) % 1;

    // Draw wireframe — cyan lines, UV coordinates wrapped to [0,1]
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = Math.max(0.4, canvasW / 1200);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (const [u0, v0, u1, v1] of edges) {
      // ZModeler / DirectX UV convention: V=0 is at the TOP of the texture.
      // No V-flip: y = frac(v) * canvasH  →  v=0 at top, v=1 at bottom.
      ctx.moveTo(frac(u0) * canvasW, frac(v0) * canvasH);
      ctx.lineTo(frac(u1) * canvasW, frac(v1) * canvasH);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Corner labels — (0,0) top-left, (1,1) bottom-right (DX/ZModeler convention)
    const fontSize60 = Math.round(canvasW / 60);
    ctx.fillStyle = "#22d3ee";
    ctx.font = `bold ${fontSize60}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText("(0,0) ↖", 6, fontSize60 + 2);
    ctx.textAlign = "right";
    ctx.fillText("(1,1) ↘", canvasW - 4, canvasH - 4);

    // Tiling notice — amber banner at top-left when UV extends beyond [0,1]
    if (isTiled) {
      const fontSize = Math.round(canvasW / 72);
      ctx.font = `bold ${fontSize}px monospace`;
      const label = `⚠ Tiled UV (${tileU}×${tileV} tile) — koordinatlar [0,1]'e katlanmıştır`;
      const metrics = ctx.measureText(label);
      const padX = 6, padY = 4;
      const bw = metrics.width + padX * 2;
      const bh = fontSize + padY * 2;
      // Background pill
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(padX, padY, bw, bh);
      ctx.fillStyle = "#fbbf24"; // amber
      ctx.textAlign = "left";
      ctx.fillText(label, padX * 2, padY + fontSize + fontSize60 + 2);
    }
  }

  return offscreen.toDataURL("image/png");
}

export function ModelViewerPanel({
  light,
  getDashboardSnapshot,
  project,
  screenId,
  resetSignal,
  onRequestCanvasResize,
}: ModelViewerPanelProps) {
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingTexture, setIsApplyingTexture] = useState(false);

  // UV map overlay state
  const [uvOpen, setUvOpen] = useState(false);
  const [uvDataUrl, setUvDataUrl] = useState<string | null>(null);
  const [uvGenerating, setUvGenerating] = useState(false);
  /**
   * Bounding box of the loaded model's UV edges, in raw UV units (may exceed
   * [0,1] for tiled meshes). `null` when no model is loaded. Used by the UV
   * modal to show the model's expected texture aspect so the user can match
   * their canvas dimensions and avoid horizontal/vertical stretching on the
   * 3D viewer.
   */
  const [uvBounds, setUvBounds] = useState<
    | { minU: number; maxU: number; minV: number; maxV: number }
    | null
  >(null);
  /**
   * Rectangle drawn by the user on top of the UV map image, stored in
   * image-pixel space (y=0 at top, same as the UV overlay canvas) and already
   * normalized (`left <= right`, `yTop <= yBot`).
   * Used to produce L/R/T/B values for the Inspector in SCS coordinates.
   */
  const [uvSelection, setUvSelection] = useState<
    | { left: number; right: number; yTop: number; yBot: number }
    | null
  >(null);
  const uvImgRef = useRef<HTMLImageElement>(null);
  const uvDragStartRef = useRef<
    | { pointerId: number; startImgX: number; startImgY: number }
    | null
  >(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number>(0);
  const currentModelRef = useRef<THREE.Object3D | null>(null);
  /**
   * Cached UV edges of the currently loaded model. Populated once on load so
   * the wireframe and canvas overlay don't re-traverse the mesh on every
   * dashboard preview refresh.
   */
  const currentUvEdgesRef = useRef<UvEdge[]>([]);
  const lastDashboardTextureRef = useRef<THREE.Texture | null>(null);
  const getDashboardSnapshotRef = useRef(getDashboardSnapshot);
  getDashboardSnapshotRef.current = getDashboardSnapshot;

  const projectRef = useRef(project);
  projectRef.current = project;
  const screenIdRef = useRef(screenId);
  screenIdRef.current = screenId;

  // Dashboard pixel size drives every pixel-space calculation below (UV overlay,
  // selection readout, textures). Hoisted above the hooks so they can be used
  // as dependencies / inside `useCallback` bodies.
  const canvasW = project?.canvasWidth ?? 800;
  const canvasH = project?.canvasHeight ?? 800;

  const disposeLastDashboardTexture = useCallback(() => {
    lastDashboardTextureRef.current?.dispose();
    lastDashboardTextureRef.current = null;
  }, []);

  const applyDashboardTexture = useCallback(
    (object: THREE.Object3D, dataUrl: string): void => {
      disposeLastDashboardTexture();

      // Use Image element directly — avoids fetch/blob issues in Tauri WebView.
      const img = new Image();
      img.onload = () => {
        // The backend-rendered dashboard PNG has a TRANSPARENT background (alpha=0
        // where there is no element). On a MeshStandardMaterial with `transparent:
        // false`, transparent pixels sample as RGB(0,0,0). We flatten the PNG onto
        // an opaque BLACK canvas — this matches how an ETS2 dashboard panel looks
        // when the backlight is off (solid black behind lit elements).
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 800;
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const octx = off.getContext("2d");
        if (!octx) {
          setIsApplyingTexture(false);
          return;
        }
        octx.fillStyle = "#000000";
        octx.fillRect(0, 0, w, h);
        octx.drawImage(img, 0, 0, w, h);

        // CanvasTexture auto-sets needsUpdate and is the most reliable path for
        // uploading a DOM canvas to the GPU in both normal browsers and Tauri WebView.
        // flipY = false: ZModeler / DirectX-convention OBJ files export V=0 at the
        // TOP of the texture, which matches our UV overlay.
        // RepeatWrapping: many ETS2 dashboard meshes use TILED UVs (coordinates >1
        // or <0) so the same dashboard repeats across N screens. Without Repeat
        // wrapping, Three.js would clamp UV>1 to the right edge pixel and the model
        // would appear as the right-edge color (empty/white) instead of the tiled
        // dashboard. The UV overlay's `frac()` wrapping already assumes this.
        const texture = new THREE.CanvasTexture(off);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = Math.min(
          8,
          rendererRef.current?.capabilities.getMaxAnisotropy() ?? 1,
        );
        texture.needsUpdate = true;
        lastDashboardTextureRef.current = texture;

        // Replace every mesh material with an UNLIT MeshBasicMaterial showing the
        // texture as-is. A truck dashboard is self-illuminated (emissive screen),
        // so we don't want scene lights to darken/tint it — basic material renders
        // pixel colors verbatim, which is exactly what the user designed.
        object.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const dispose = (m: THREE.Material) => m.dispose?.();
          const prev = child.material;
          if (Array.isArray(prev)) prev.forEach(dispose);
          else if (prev) dispose(prev);
          child.material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            color: 0xffffff,
            toneMapped: false,
          });
        });
        setIsApplyingTexture(false);
      };
      img.onerror = () => {
        console.warn("[ModelViewer] Dashboard texture image load failed");
        setIsApplyingTexture(false);
      };
      img.src = dataUrl;
    },
    [disposeLastDashboardTexture],
  );

  const getDashboardDataUrl = useCallback(async (): Promise<string | null> => {
    const proj = projectRef.current;
    const sid = screenIdRef.current;

    if (proj && sid != null) {
      try {
        const b64 = await invoke<string | null>("render_screen_preview_png_b64", {
          project: proj,
          screenId: sid,
        });
        if (b64) return `data:image/png;base64,${b64}`;
      } catch {
        /* fall through */
      }
    }

    const snap = getDashboardSnapshotRef.current?.();
    return snap ?? null;
  }, []);

  const refreshTexture = useCallback(async (): Promise<void> => {
    const model = currentModelRef.current;
    if (!model) return;
    setIsApplyingTexture(true);
    const dataUrl = await getDashboardDataUrl();
    if (dataUrl && currentModelRef.current) {
      applyDashboardTexture(currentModelRef.current, dataUrl);
    } else {
      setIsApplyingTexture(false);
    }
  }, [getDashboardDataUrl, applyDashboardTexture]);

  /** Open the UV map overlay, generating it if needed. */
  const openUvMap = useCallback(async () => {
    const model = currentModelRef.current;
    if (!model) return;
    setUvGenerating(true);
    setUvOpen(true);
    try {
      const proj = projectRef.current;
      const cw = proj?.canvasWidth ?? 800;
      const ch = proj?.canvasHeight ?? 800;
      const bg = await getDashboardDataUrl();
      const url = await renderUvWireframe(
        currentUvEdgesRef.current,
        cw,
        ch,
        bg,
        light,
      );
      setUvDataUrl(url);
    } finally {
      setUvGenerating(false);
    }
  }, [getDashboardDataUrl, light]);

  /** Re-generate UV map when project changes (if panel is open). */
  useEffect(() => {
    if (!uvOpen || !currentModelRef.current) return;
    void openUvMap();
    // A project resize invalidates pixel-based coords on the old image; drop
    // the selection so stale numbers aren't shown.
    setUvSelection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, screenId]);

  /**
   * Convert a client-coordinate mouse position to image-natural-pixel space,
   * clamped to the image bounds. Works even when the image is scaled by the
   * modal (which it is when max-width:100% kicks in on small viewports).
   */
  const clientToImagePx = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const img = uvImgRef.current;
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return null;
      const sx = (clientX - rect.left) / rect.width;
      const sy = (clientY - rect.top) / rect.height;
      const nW = img.naturalWidth || canvasW;
      const nH = img.naturalHeight || canvasH;
      return {
        x: Math.min(nW, Math.max(0, sx * nW)),
        y: Math.min(nH, Math.max(0, sy * nH)),
      };
    },
    [canvasW, canvasH],
  );

  const onUvPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const pt = clientToImagePx(e.clientX, e.clientY);
      if (!pt) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      uvDragStartRef.current = {
        pointerId: e.pointerId,
        startImgX: pt.x,
        startImgY: pt.y,
      };
      setUvSelection({
        left: pt.x,
        right: pt.x,
        yTop: pt.y,
        yBot: pt.y,
      });
    },
    [clientToImagePx],
  );

  const onUvPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = uvDragStartRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const pt = clientToImagePx(e.clientX, e.clientY);
      if (!pt) return;
      const left = Math.min(drag.startImgX, pt.x);
      const right = Math.max(drag.startImgX, pt.x);
      const yTop = Math.min(drag.startImgY, pt.y);
      const yBot = Math.max(drag.startImgY, pt.y);
      setUvSelection({ left, right, yTop, yBot });
    },
    [clientToImagePx],
  );

  const onUvPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = uvDragStartRef.current;
      if (drag && drag.pointerId === e.pointerId) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        uvDragStartRef.current = null;
      }
      // Discard tiny click-only drags so the user can clear a selection by
      // just tapping on the image.
      setUvSelection((sel) => {
        if (!sel) return sel;
        const w = sel.right - sel.left;
        const h = sel.yBot - sel.yTop;
        if (w < 2 && h < 2) return null;
        return sel;
      });
    },
    [],
  );

  /**
   * SCS-space readout of the current selection. The dashboard canvas Y axis
   * points UP (bottom-left origin) whereas the UV map image Y axis points DOWN
   * (top-left origin), so we flip: `coordsT/B = canvasH - imageY`.
   */
  const uvSelectionScs = useMemo(() => {
    if (!uvSelection) return null;
    const L = Math.round(uvSelection.left);
    const R = Math.round(uvSelection.right);
    const T = Math.round(canvasH - uvSelection.yTop);
    const B = Math.round(canvasH - uvSelection.yBot);
    return {
      L,
      R,
      T,
      B,
      width: Math.max(0, R - L),
      height: Math.max(0, T - B),
    };
  }, [uvSelection, canvasH]);

  /**
   * Derives the model's expected texture aspect from the UV bounding box and
   * compares it to the current project canvas aspect. When they diverge, the
   * 3D viewer visibly stretches text / icons (the texture is sampled from UV
   * units but mapped onto a mesh face with a different proportion).
   *
   * * For non-tiled models (UV fits within [0,1]²) the suggested aspect is
   *   simply `uvBoxW / uvBoxH`.
   * * For tiled models (UV extends beyond [0,1] in either axis) the per-tile
   *   size is 1.0 × 1.0 UV units, so the texture should be SQUARE (1:1) and
   *   the user likely wants to design a single tile and let RepeatWrapping
   *   replicate it across the mesh.
   */
  const uvAspectInfo = useMemo(() => {
    if (!uvBounds) return null;
    const uvW = Math.max(1e-6, uvBounds.maxU - uvBounds.minU);
    const uvH = Math.max(1e-6, uvBounds.maxV - uvBounds.minV);
    const tiled =
      uvBounds.minU < -1e-4 ||
      uvBounds.maxU > 1 + 1e-4 ||
      uvBounds.minV < -1e-4 ||
      uvBounds.maxV > 1 + 1e-4;
    // For tiled models the "useful" aspect is the per-tile aspect (1.0). For
    // planar UVs we expose the bounding box aspect directly.
    const suggestedAspect = tiled ? 1.0 : uvW / uvH;
    const canvasAspect = canvasW / Math.max(1, canvasH);
    const mismatch = Math.abs(canvasAspect - suggestedAspect) / suggestedAspect;
    return {
      uvW,
      uvH,
      tiled,
      suggestedAspect,
      canvasAspect,
      /** Fractional mismatch — > 0.02 (≈2 %) is already visible on typical text. */
      mismatch,
    };
  }, [uvBounds, canvasW, canvasH]);

  // Three.js scene/renderer init
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.01,
      10000,
    );
    cam.position.set(0, 0, 5);
    cameraRef.current = cam;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(light ? 0xf1f5f9 : 0x020617, 1);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 10, 7.5);
    scene.add(dir);

    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const resizeObserver = new ResizeObserver(() => {
      const el = containerRef.current;
      const r = rendererRef.current;
      const c = cameraRef.current;
      if (!el || !r || !c) return;
      const w = el.clientWidth;
      const h = Math.max(el.clientHeight, 1);
      c.aspect = w / h;
      c.updateProjectionMatrix();
      r.setSize(w, h);
    });
    resizeObserver.observe(container);

    const animate = (): void => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, cam);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      lastDashboardTextureRef.current?.dispose();
      lastDashboardTextureRef.current = null;
      const parentEl = renderer.domElement.parentElement;
      if (parentEl) parentEl.removeChild(renderer.domElement);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      currentModelRef.current = null;
      currentUvEdgesRef.current = [];
      // Don't leave stale UV edges in the shared canvas store if the whole
      // panel unmounts (e.g. user closed the app or switched projects).
      useCanvasStore.getState().setUvEdges(null);
    };
  }, []);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.setClearColor(light ? 0xf1f5f9 : 0x020617, 1);
  }, [light]);

  const loadModel = useCallback(
    async (path: string) => {
      const scene = sceneRef.current;
      const cam = cameraRef.current;
      const controls = controlsRef.current;
      if (!scene || !cam || !controls) return;

      const prev = currentModelRef.current;
      if (prev) {
        scene.remove(prev);
        prev.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            const mat = child.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat?.dispose();
          }
        });
        currentModelRef.current = null;
      }

      setIsLoading(true);
      setError(null);
      setUvDataUrl(null);

      const lower = path.toLowerCase();
      const ext = lower.endsWith(".glb")
        ? "glb"
        : lower.endsWith(".gltf")
          ? "gltf"
          : lower.endsWith(".obj")
            ? "obj"
            : null;

      try {
        const bytes = await readFile(path);
        const blob = new Blob([bytes]);
        const blobUrl = URL.createObjectURL(blob);
        const filename = path.split(/[/\\]/).pop() ?? path;

        await new Promise<void>((resolve, reject) => {
          const revokeBlobUrl = (): void => URL.revokeObjectURL(blobUrl);

          const afterLoad = async (loaded: THREE.Object3D): Promise<void> => {
            fitCameraToObject(loaded, cam, controls);
            setModelPath(path);
            setModelName(filename);
            setIsLoading(false);
            revokeBlobUrl();
            // Cache UV edges and publish them to the canvas store so the
            // dashboard canvas can draw a UV wireframe overlay behind the
            // user's elements.
            const edges = extractUvEdges(loaded);
            currentUvEdgesRef.current = edges;
            useCanvasStore.getState().setUvEdges(edges.length ? edges : null);
            setUvBounds(computeUvBounds(edges));
            setIsApplyingTexture(true);
            const dataUrl = await getDashboardDataUrl();
            if (dataUrl && currentModelRef.current === loaded) {
              applyDashboardTexture(loaded, dataUrl);
            } else {
              setIsApplyingTexture(false);
            }
            resolve();
          };

          if (ext === "glb" || ext === "gltf") {
            const loader = new GLTFLoader();
            loader.load(
              blobUrl,
              (gltf) => {
                try {
                  scene.add(gltf.scene);
                  currentModelRef.current = gltf.scene;
                  gltf.scene.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                      const ensureReady = (mat: THREE.Material): void => {
                        if (
                          mat instanceof THREE.MeshStandardMaterial ||
                          mat instanceof THREE.MeshBasicMaterial
                        ) {
                          mat.side = THREE.DoubleSide;
                          mat.needsUpdate = true;
                        }
                      };
                      if (Array.isArray(child.material))
                        child.material.forEach(ensureReady);
                      else ensureReady(child.material);
                    }
                  });
                  void afterLoad(gltf.scene);
                } catch (e) {
                  revokeBlobUrl();
                  reject(e);
                }
              },
              undefined,
              (err) => {
                revokeBlobUrl();
                reject(err instanceof Error ? err : new Error(String(err)));
              },
            );
          } else if (ext === "obj") {
            const loader = new OBJLoader();
            loader.load(
              blobUrl,
              (group) => {
                try {
                  group.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                      const makeMat = () =>
                        new THREE.MeshStandardMaterial({
                          color: 0xffffff,
                          side: THREE.DoubleSide,
                        });
                      if (Array.isArray(child.material)) {
                        child.material = child.material.map(() => makeMat());
                      } else {
                        child.material = makeMat();
                      }
                    }
                  });
                  scene.add(group);
                  currentModelRef.current = group;
                  void afterLoad(group);
                } catch (e) {
                  revokeBlobUrl();
                  reject(e);
                }
              },
              undefined,
              (err) => {
                revokeBlobUrl();
                reject(err instanceof Error ? err : new Error(String(err)));
              },
            );
          } else {
            revokeBlobUrl();
            reject(new Error("Desteklenmeyen format. GLB, GLTF veya OBJ kullanın."));
          }
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Model yüklenemedi: ${msg}`);
        setIsLoading(false);
        setIsApplyingTexture(false);
      }
    },
    [getDashboardDataUrl, applyDashboardTexture],
  );

  const handleLoadModel = useCallback(async () => {
    try {
      const sel = await open({
        multiple: false,
        filters: [{ name: "3D Models", extensions: ["glb", "gltf", "obj"] }],
      });
      if (sel === null || Array.isArray(sel)) return;
      await loadModel(sel);
    } catch {
      /* cancelled */
    }
  }, [loadModel]);

  const removeModel = useCallback(() => {
    const scene = sceneRef.current;
    const prev = currentModelRef.current;
    if (prev && scene) {
      scene.remove(prev);
      prev.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          const mat = child.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      currentModelRef.current = null;
    }
    disposeLastDashboardTexture();
    currentUvEdgesRef.current = [];
    useCanvasStore.getState().setUvEdges(null);
    setUvBounds(null);
    setModelPath(null);
    setModelName(null);
    setError(null);
    setIsApplyingTexture(false);
    setUvOpen(false);
    setUvDataUrl(null);
    setUvSelection(null);
  }, [disposeLastDashboardTexture]);

  // Re-apply texture when project / active screen changes.
  useEffect(() => {
    if (!currentModelRef.current) return;
    void refreshTexture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, screenId, getDashboardSnapshot]);

  // Clear the loaded model when the parent asks (e.g. on "New Project").
  // Using a ref avoids re-running on every removeModel identity change.
  const removeModelRef = useRef(removeModel);
  removeModelRef.current = removeModel;
  const resetSignalSeenRef = useRef<number | undefined>(resetSignal);
  useEffect(() => {
    // Only react when the signal actually changes from its last observed value.
    // This prevents clearing the model on initial mount.
    if (resetSignal === undefined) return;
    if (resetSignalSeenRef.current === resetSignal) return;
    resetSignalSeenRef.current = resetSignal;
    removeModelRef.current();
  }, [resetSignal]);

  // ── Styles ────────────────────────────────────────────────────
  const headerBtn =
    light
      ? "rounded border border-slate-400 bg-white px-2 py-1 text-xs text-slate-800 hover:bg-slate-100 disabled:opacity-40"
      : "rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40";

  const shell =
    light
      ? "flex h-full min-h-0 flex-col border-b border-slate-300 bg-white text-slate-900"
      : "flex h-full min-h-0 flex-col border-b border-slate-700 bg-slate-950 text-slate-100";

  const footerTxt = light ? "text-slate-600" : "text-slate-400";

  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden ${shell}`}>
      {/* ── Header ───────────────────────────────────────────── */}
      {/* Fixed min-height + nowrap prevents the header from expanding to two
          rows when the panel gets narrow (which previously caused the 3D canvas
          to resize in a feedback loop with the ResizeObserver → visual jitter
          until the window resolution was changed). Overflow-x:auto lets
          extreme narrow cases scroll rather than reflow vertically. */}
      <header
        className={
          light
            ? "flex shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-300 px-3 py-2"
            : "flex shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-700 px-3 py-2"
        }
        style={{ minHeight: 44, flexWrap: "nowrap" }}
      >
        <h2 className="flex min-w-0 items-center text-sm font-semibold">
          <span className="shrink-0">3D Model Görüntüleyici</span>
          {modelName ? (
            <span
              className="ml-2 min-w-0 truncate font-normal text-slate-500"
              title={modelName}
            >
              {modelName}
            </span>
          ) : null}
        </h2>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button type="button" className={headerBtn} onClick={() => void handleLoadModel()}>
            Model yükle…
          </button>
          {modelName !== null ? (
            <>
              <button
                type="button"
                className={headerBtn}
                disabled={isApplyingTexture}
                title="Dashboard görüntüsünü modele yeniden uygula"
                onClick={() => void refreshTexture()}
              >
                {isApplyingTexture ? "Uygulanıyor…" : "Doku yenile"}
              </button>

              {/* ── UV Map button ───────────────────── */}
              <button
                type="button"
                className={
                  light
                    ? "rounded border border-indigo-400 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-40"
                    : "rounded border border-indigo-600 bg-indigo-950/60 px-2 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-900/60 disabled:opacity-40"
                }
                disabled={uvGenerating}
                title="Modelin UV haritasını dashboard üzerine bindirerek göster"
                onClick={() => void openUvMap()}
              >
                {uvGenerating ? "Oluşturuluyor…" : "UV Haritası"}
              </button>

              <button
                type="button"
                className={
                  light
                    ? "rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    : "rounded border border-red-800 bg-slate-900 px-2 py-1 text-xs text-red-400 hover:bg-red-950/40"
                }
                onClick={removeModel}
                title="Modeli sahneden kaldır"
              >
                Modeli kaldır
              </button>
            </>
          ) : null}
        </div>
      </header>

      {/* ── 3D Viewport ──────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div ref={containerRef} className="relative min-h-0 w-full flex-1 overflow-hidden" />

        {(isLoading || isApplyingTexture) ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
              aria-hidden
            />
            {isApplyingTexture && !isLoading ? (
              <p className={`text-xs ${footerTxt}`}>Dashboard dokusu uygulanıyor…</p>
            ) : null}
          </div>
        ) : null}

        {!modelName && !isLoading ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className={`text-sm ${footerTxt}`}>Henüz model yüklenmedi.</p>
            <p className={`max-w-xs text-xs ${light ? "text-slate-400" : "text-slate-600"}`}>
              <strong>İpucu:</strong> Modelin UV haritası dashboard çözünürlüğünüzle
              ({canvasW}×{canvasH}) örtüşecek şekilde hazırlanmış olmalıdır.
              Desteklenen formatlar: GLB, GLTF, OBJ.
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            className={
              light
                ? "absolute left-4 right-4 top-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
                : "absolute left-4 right-4 top-4 rounded border border-red-800 bg-red-950/90 px-3 py-2 text-sm text-red-200"
            }
            role="alert"
          >
            {error}
          </div>
        ) : null}
      </div>

      <footer
        className={
          light
            ? "flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-slate-300 px-4 py-2 text-xs"
            : "flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-slate-700 px-4 py-2 text-xs"
        }
      >
        <span
          className={`max-w-xl truncate font-mono ${footerTxt}`}
          title={modelPath ?? undefined}
        >
          {modelPath ?? "Model yüklenmedi"}
        </span>
        <span className={footerTxt}>
          Sol sürükle: döndür · Sağ sürükle: kaydır · Tekerlek: yakınlaştır
        </span>
      </footer>

      {/* ── UV Map Modal ─────────────────────────────────────── */}
      {uvOpen ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="UV Haritası"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setUvOpen(false);
          }}
        >
          <div
            className={
              light
                ? "flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
                : "flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            }
          >
            {/* Modal header */}
            <div
              className={
                light
                  ? "flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3"
                  : "flex shrink-0 items-center gap-3 border-b border-slate-700 px-4 py-3"
              }
            >
              <h3 className={`font-semibold ${light ? "text-slate-900" : "text-slate-100"}`}>
                UV Haritası
                <span className={`ml-2 text-xs font-normal ${light ? "text-slate-500" : "text-slate-400"}`}>
                  {canvasW}×{canvasH} px · modelin UV koordinatları dashboard üzerine bindirilmiş
                </span>
              </h3>
              <div className="ml-auto flex items-center gap-2">
                {uvDataUrl ? (
                  <a
                    href={uvDataUrl}
                    download={`uv_map_${modelName ?? "model"}.png`}
                    className={
                      light
                        ? "inline-flex items-center gap-1.5 rounded border border-emerald-400 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                        : "inline-flex items-center gap-1.5 rounded border border-emerald-600 bg-emerald-950/50 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/60"
                    }
                    title="UV haritasını PNG olarak indir — dashboard tasarımında referans olarak kullan"
                  >
                    <Download size={12} aria-hidden />
                    PNG indir
                  </a>
                ) : null}
                <button
                  type="button"
                  className={
                    light
                      ? "rounded border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                      : "rounded border border-slate-600 bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700"
                  }
                  onClick={() => setUvOpen(false)}
                  title="Kapat"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {uvGenerating || !uvDataUrl ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                </div>
              ) : (
                <div
                  className="relative mx-auto inline-block select-none"
                  style={{ touchAction: "none", cursor: "crosshair" }}
                  onPointerDown={onUvPointerDown}
                  onPointerMove={onUvPointerMove}
                  onPointerUp={onUvPointerUp}
                  onPointerCancel={onUvPointerUp}
                >
                  <img
                    ref={uvImgRef}
                    src={uvDataUrl}
                    alt="UV haritası"
                    draggable={false}
                    className="block max-w-full rounded border border-slate-600/30"
                    style={{ imageRendering: "pixelated" }}
                  />
                  {uvSelection ? (
                    // Absolute-positioned overlay using percent coords so it
                    // tracks the image when the modal scales it down. Percent
                    // is relative to natural image size = canvasW × canvasH.
                    <div
                      className="pointer-events-none absolute border-2 border-amber-400 bg-amber-400/15"
                      style={{
                        left: `${(uvSelection.left / canvasW) * 100}%`,
                        top: `${(uvSelection.yTop / canvasH) * 100}%`,
                        width: `${((uvSelection.right - uvSelection.left) / canvasW) * 100}%`,
                        height: `${((uvSelection.yBot - uvSelection.yTop) / canvasH) * 100}%`,
                      }}
                    >
                      {/* Corner ticks for visibility over any texture color */}
                      <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-slate-900/50" />
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-slate-900/50" />
                      <span className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-slate-900/50" />
                      <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-slate-900/50" />
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Selection readout — only when the user has drawn a rectangle */}
            {uvSelectionScs ? (
              <div
                className={
                  light
                    ? "shrink-0 border-t border-slate-200 bg-amber-50/60 px-4 py-2.5"
                    : "shrink-0 border-t border-slate-700 bg-amber-950/20 px-4 py-2.5"
                }
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                  <span className={`font-semibold ${light ? "text-amber-800" : "text-amber-300"}`}>
                    Seçim (SCS, {canvasW}×{canvasH}):
                  </span>
                  {(
                    [
                      ["L", uvSelectionScs.L],
                      ["R", uvSelectionScs.R],
                      ["T", uvSelectionScs.T],
                      ["B", uvSelectionScs.B],
                    ] as const
                  ).map(([label, val]) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 font-mono"
                    >
                      <span className={light ? "text-slate-500" : "text-slate-400"}>
                        {label}
                      </span>
                      <button
                        type="button"
                        className={
                          light
                            ? "rounded bg-white px-1.5 py-0.5 text-slate-900 ring-1 ring-slate-300 hover:bg-slate-100"
                            : "rounded bg-slate-800 px-1.5 py-0.5 text-slate-100 ring-1 ring-slate-600 hover:bg-slate-700"
                        }
                        title={`${label} = ${val} (tıkla → panoya kopyala)`}
                        onClick={() => {
                          void navigator.clipboard?.writeText(String(val));
                        }}
                      >
                        {val}
                      </button>
                    </span>
                  ))}
                  <span className={`ml-2 font-mono ${light ? "text-slate-500" : "text-slate-400"}`}>
                    genişlik {uvSelectionScs.width} · yükseklik {uvSelectionScs.height}
                  </span>
                  <button
                    type="button"
                    className={
                      light
                        ? "ml-auto rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100"
                        : "ml-auto rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700"
                    }
                    onClick={() => setUvSelection(null)}
                  >
                    Seçimi temizle
                  </button>
                </div>
              </div>
            ) : null}

            {/*
             * Aspect-mismatch banner: warns when the current canvas aspect
             * diverges from the model's UV aspect (the root cause of the
             * "fonts / icons appear stretched on the 3D viewer but look fine
             * on the canvas" issue). Clicking the button hoists the dialog up
             * to the host so it can be committed through undo/redo.
             */}
            {uvAspectInfo && uvAspectInfo.mismatch > 0.02 ? (
              <div
                className={
                  light
                    ? "shrink-0 border-t border-slate-200 bg-rose-50/70 px-4 py-2.5 text-xs text-rose-900"
                    : "shrink-0 border-t border-slate-700 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200"
                }
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">Aspect uyuşmazlığı:</span>
                  <span className="font-mono">
                    canvas {uvAspectInfo.canvasAspect.toFixed(3)}:1 ·{" "}
                    model{" "}
                    {uvAspectInfo.tiled
                      ? "1.000:1 (tiled, 1 tile = 1×1 UV)"
                      : `${uvAspectInfo.suggestedAspect.toFixed(3)}:1`}
                  </span>
                  <span className="opacity-80">
                    — 3B görüntüleyicide yazı/ikonlar yatay/dikey gerinir.
                  </span>
                  {onRequestCanvasResize ? (
                    <button
                      type="button"
                      className={
                        light
                          ? "ml-auto rounded border border-rose-400 bg-white px-2.5 py-0.5 text-[11px] font-medium text-rose-800 hover:bg-rose-50"
                          : "ml-auto rounded border border-rose-500 bg-slate-900 px-2.5 py-0.5 text-[11px] font-medium text-rose-200 hover:bg-rose-950/50"
                      }
                      onClick={() =>
                        onRequestCanvasResize(uvAspectInfo.suggestedAspect)
                      }
                    >
                      Canvas'ı modele uydur…
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Modal footer / hint */}
            <div
              className={
                light
                  ? "shrink-0 border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600"
                  : "shrink-0 border-t border-slate-700 px-4 py-2.5 text-xs text-slate-400"
              }
            >
              <strong>Nasıl kullanılır:</strong> Görsel üzerinde sürükleyerek bir
              alan seçin — Inspector'a girmek için hazır L / R / T / B değerleri
              altta gösterilir (her değere tıklayınca panoya kopyalanır). PNG'yi
              indirip dashboard tasarım dosyanıza arka plan olarak da ekleyebilirsiniz.
              Cyan çizgiler modelin UV kenarlarını gösterir; üstte sarı uyarı varsa
              UV 0–1 aralığını aşıyor (tiled texture) ve otomatik katlanıyor demektir.
              Aynı UV haritasını tuval üzerinde göstermek için araç çubuğundaki{" "}
              <span className={light ? "font-medium text-cyan-700" : "font-medium text-cyan-300"}>
                UV overlay
              </span>{" "}
              düğmesini kullanabilirsiniz.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
