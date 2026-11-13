"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  GROUP_ORDER,
  MODE_OPTIONS,
  RELATION_LABEL,
  ZONE_LABEL,
  groupOf,
  matchesAudience,
  normalizeAudienceFilter,
  type Audience,
  type AudienceFilter,
  type RelationType,
} from "@/lib/groups";
import type { McpCallEvent } from "@/lib/mcp-events";

type BrainNode = {
  slug: string;
  title: string;
  folder: string;
  audience: Audience;
  degree: number;
  keywords?: string;
  pos?: [number, number, number];
};
type Props = { nodes: BrainNode[]; links: [number, number][]; rels?: RelationType[]; children?: ReactNode };
type Scene3D = { select(i: number): void; emphasize(set: Set<number> | null): void; pulse(indices: number[]): void; reset(): void; spin(on: boolean): void };
type TermRect = { x: number; y: number; w: number; h: number };
type ResizeDir = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

const TERM_STORAGE_KEY = "bc_mcp_term_rect_v1";
const RESIZE_DIRS: ResizeDir[] = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];

function clampTermRect(r: TermRect, vw: number, vh: number): TermRect {
  const minW = Math.min(340, Math.max(260, vw - 16));
  const minH = Math.min(170, Math.max(140, vh - 16));
  const w = Math.round(Math.min(Math.max(r.w, minW), vw - 16));
  const h = Math.round(Math.min(Math.max(r.h, minH), vh - 16));
  const x = Math.round(Math.min(Math.max(r.x, 8), vw - w - 8));
  const y = Math.round(Math.min(Math.max(r.y, 8), vh - h - 8));
  return { x, y, w, h };
}

const R = new THREE.Vector3(6.2, 4.8, 7.4); // brain ellipsoid radii: x left-right, y up, z front-back

// deterministic random so the brain looks the same on every visit
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function keepInside(p: THREE.Vector3, limit: number) {
  const k = (p.x / R.x) ** 2 + (p.y / R.y) ** 2 + (p.z / R.z) ** 2;
  if (k > limit) p.multiplyScalar(Math.sqrt(limit / k));
}

/** Folders become lobes; a short force simulation pulls linked notes together inside the skull. */
function layout(nodes: BrainNode[], links: [number, number][]) {
  const rand = rng(42);
  const folders = [...new Set(nodes.map((n) => n.folder))].filter((f) => f !== "root").sort();
  const centers = new Map<string, THREE.Vector3>([["root", new THREE.Vector3(0, 0.4, 0)]]);
  folders.forEach((f, i) => {
    const y = 1 - (2 * (i + 0.5)) / folders.length;
    const r = Math.sqrt(1 - y * y);
    const phi = i * 2.399963 + 0.6; // golden angle spreads lobes evenly
    centers.set(f, new THREE.Vector3(Math.cos(phi) * r * R.x * 0.55, y * R.y * 0.42, Math.sin(phi) * r * R.z * 0.55));
  });
  const pos = nodes.map((n) =>
    centers.get(n.folder)!.clone().add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(3)),
  );
  const vel = pos.map(() => new THREE.Vector3());
  const d = new THREE.Vector3();
  const steps = 220;
  for (let it = 0; it < steps; it++) {
    const heat = 1 - it / steps;
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) {
        d.subVectors(pos[i], pos[j]);
        d.multiplyScalar(0.5 / Math.max(d.lengthSq(), 0.05));
        vel[i].add(d);
        vel[j].sub(d);
      }
    for (const [a, b] of links) {
      d.subVectors(pos[b], pos[a]);
      const l = d.length() || 0.01;
      d.multiplyScalar(((l - 2.2) * 0.03) / l);
      vel[a].add(d);
      vel[b].sub(d);
    }
    pos.forEach((p, i) => {
      vel[i].add(d.subVectors(centers.get(nodes[i].folder)!, p).multiplyScalar(0.012));
      p.addScaledVector(vel[i], heat);
      vel[i].multiplyScalar(0.55);
      keepInside(p, 0.78);
    });
  }
  return pos;
}

/** Soft folded shell made of dust: two hemispheres with gyri-like bumps. */
function shellGeometry(count: number) {
  const rand = rng(7);
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const x = s * Math.cos(th);
    const z = s * Math.sin(th);
    const y = u < -0.4 ? -0.4 + (u + 0.4) * 0.5 : u;
    const fold = 1 + 0.05 * Math.sin(9 * x + 3 * y) * Math.cos(8 * z - 2 * y) + 0.03 * Math.sin(17 * y + 5 * z);
    const depth = 0.92 + rand() * 0.08;
    arr.set([x * R.x * fold * depth + Math.sign(x) * 0.35, y * R.y * fold * depth + 0.3, z * R.z * fold * depth], i * 3);
  }
  return new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(arr, 3));
}

// setFromPoints never grows an existing buffer, so highlight lines get a fresh geometry each time
function setLines(line: THREE.LineSegments, pts: THREE.Vector3[]) {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutCubic = (k: number) => 1 - (1 - k) ** 3;
const easeOutBack = (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2; // overshoots a little: cells "pop" into place

/** Server renders the final number (SEO); the client counts up to it once the hero fades in. */
export function CountUp({ to, delay = 600 }: { to: number; delay?: number }) {
  const [n, setN] = useState(to);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now() + delay;
    let f = 0;
    const tick = (now: number) => {
      const k = clamp01((now - t0) / 1800);
      setN(Math.round(to * easeOutCubic(k)));
      if (k < 1) f = requestAnimationFrame(tick);
    };
    f = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(f);
  }, [to, delay]);
  return <>{n.toLocaleString("th-TH")}</>;
}

export default function Brain3D({ nodes, links, rels, children }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const stream = useRef<HTMLButtonElement>(null); // "latest signal" ticker, written by the render loop
  const fired = useRef(-1);
  const scene3d = useRef<Scene3D | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<AudienceFilter>("all");
  const modeRef = useRef<AudienceFilter>("all");
  modeRef.current = mode;
  const [selected, setSelected] = useState(-1);
  const [group, setGroup] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [spinning, setSpinning] = useState(true);
  const [mcpLogs, setMcpLogs] = useState<McpCallEvent[]>([]);
  const [termOpen, setTermOpen] = useState(false);
  const [termLive, setTermLive] = useState(false);
  const [termBurst, setTermBurst] = useState(false);
  const [testingMcp, setTestingMcp] = useState(false);
  const [termRect, setTermRect] = useState<TermRect | null>(null);
  const [termDragging, setTermDragging] = useState(false);
  const termRef = useRef<HTMLElement>(null);
  const termBodyRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef<(i: number) => void>(() => {});

  const slugIndex = useMemo(() => new Map(nodes.map((n, i) => [n.slug, i])), [nodes]);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("mode");
    const initial = normalizeAudienceFilter(param);
    if (initial !== "all") setMode(initial);
    try {
      const raw = localStorage.getItem(TERM_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<TermRect>;
        if ([p.x, p.y, p.w, p.h].every((v) => typeof v === "number" && Number.isFinite(v))) {
          setTermRect(clampTermRect(p as TermRect, window.innerWidth, window.innerHeight));
        }
      }
    } catch {
      // ignore storage errors
    }
    const onWinResize = () => {
      setTermRect((prev) => (prev ? clampTermRect(prev, window.innerWidth, window.innerHeight) : null));
    };
    window.addEventListener("resize", onWinResize);
    return () => window.removeEventListener("resize", onWinResize);
  }, []);

  const neighbors = useMemo(() => {
    const nb = nodes.map(() => [] as { idx: number; rel: RelationType }[]);
    links.forEach(([a, b], k) => {
      const rel: RelationType = rels?.[k] ?? "related";
      nb[a].push({ idx: b, rel });
      nb[b].push({ idx: a, rel });
    });
    return nb;
  }, [nodes, links, rels]);

  const groups = useMemo(() => {
    const c = new Map<string, number>();
    nodes.forEach((n) => {
      if (matchesAudience(n.audience, mode)) c.set(n.folder, (c.get(n.folder) ?? 0) + 1);
    });
    return [...c].sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a[0]);
      const ib = GROUP_ORDER.indexOf(b[0]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [nodes, mode]);

  const needle = q.trim().toLowerCase().replace(/สต๊อก/g, "สต็อก");
  const matches = useMemo(
    () =>
      needle
        ? nodes
            .flatMap((n, i) =>
              matchesAudience(n.audience, mode) &&
              `${n.title} ${n.slug} ${n.keywords ?? ""}`.toLowerCase().replace(/สต๊อก/g, "สต็อก").includes(needle)
                ? [i]
                : [],
            )
            .sort((a, b) => nodes[b].degree - nodes[a].degree)
        : [],
    [nodes, needle, mode],
  );

  const visibleNeighbors = useMemo(
    () => (selected >= 0 ? neighbors[selected].filter((nb) => matchesAudience(nodes[nb.idx].audience, mode)) : []),
    [selected, neighbors, nodes, mode],
  );

  useEffect(() => {
    const el = mount.current;
    if (!el || !nodes.length) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "แผนภาพสมอง 3 มิติ: จุดคือโน้ตความรู้ เส้นคือการเชื่อมโยง");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0820);
    scene.fog = new THREE.FogExp2(0x0b0820, 0.018);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 6, 46);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(4, 6, 10); // rides with the camera, so cells are always lit from the viewer's side
    camera.add(sun);
    scene.add(camera, new THREE.AmbientLight(0xffffff, 1.3));
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 5, maxDistance: 40, autoRotate: !still, autoRotateSpeed: 0.5 });

    const dot = dotTexture();
    const disposables: { dispose(): void }[] = [dot, renderer, controls];
    const add = <T extends THREE.Object3D & { geometry: THREE.BufferGeometry; material: THREE.Material }>(o: T) => {
      disposables.push(o.geometry, o.material);
      scene.add(o);
      return o;
    };
    const glow = (size: number, opacity: number, color?: number, blending: THREE.Blending = THREE.AdditiveBlending) =>
      new THREE.PointsMaterial({
        map: dot, size, transparent: true, opacity, depthWrite: false, blending,
        vertexColors: color === undefined, color: color ?? 0xffffff,
      });

    // skull dust + far stardust, kept faint so the cells stay readable
    const dust = add(new THREE.Points(shellGeometry(6000), glow(0.1, still ? 0.2 : 0, 0x7a6be0)));
    const starArr = new Float32Array(900 * 3).map(() => (Math.random() - 0.5) * 90);
    const stars = add(new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(starArr, 3)), glow(0.12, 0.35, 0x6f7bff)));

    // neurons: lit pastel beads; they shrink as the vault grows so hundreds of notes never blur into one white blob
    const pos = nodes.every((n) => n.pos)
      ? nodes.map((n) => new THREE.Vector3(n.pos![0], n.pos![1], n.pos![2]))
      : layout(nodes, links);
    const colors = nodes.map((n) => new THREE.Color(groupOf(n.folder).color));
    const k = Math.min(1, Math.max(0.55, Math.sqrt(120 / nodes.length)));
    const baseSize = nodes.map((n) => (n.folder === "root" ? 0.3 : (0.12 + 0.04 * Math.sqrt(n.degree)) * k));
    const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhongMaterial({ shininess: 80, specular: 0x444444 }), nodes.length);
    colors.forEach((c, i) => balls.setColorAt(i, c));
    add(balls);
    const haloGeom = new THREE.BufferGeometry().setFromPoints(pos);
    const haloCol = new THREE.Float32BufferAttribute(colors.flatMap((c) => [c.r, c.g, c.b]), 3);
    haloGeom.setAttribute("color", haloCol);
    // normal (not additive) blending: overlapping halos mix colours instead of summing to white
    const halos = add(new THREE.Points(haloGeom, glow(0.75 * k, 0.28, undefined, THREE.NormalBlending)));
    // these move every frame (intro, sparks), so a bounding sphere computed on frame 1 would cull them wrongly
    balls.frustumCulled = halos.frustumCulled = false;

    // intro "big bang": every cell bursts out of the core and spirals into its lobe, nearest cells first
    const INTRO = still ? 0 : 3.4;
    const live = pos.map((p) => (still ? p.clone() : new THREE.Vector3()));
    const far = Math.max(...pos.map((p) => p.length()), 1);
    const delay = pos.map((p) => 0.2 + (p.length() / far) * 1.3 + Math.random() * 0.25);
    const pop = new Float32Array(nodes.length).fill(still ? 1 : 0);
    let introDone = still;
    const shown = colors.map((c) => c.clone()); // colour after search/group/mode dimming; flashes brighten from here

    // synapses: gently curved toward the centre like axons
    const curves = links.map(([a, b]) => {
      const mid = pos[a].clone().add(pos[b]).multiplyScalar(0.5);
      return new THREE.QuadraticBezierCurve3(pos[a], mid.multiplyScalar(0.72).add(new THREE.Vector3(0, 0.6, 0)), pos[b]);
    });
    const curvePts = curves.map((cv) => cv.getPoints(12));
    const segs = (ks: number[]) => ks.flatMap((i) => curvePts[i].flatMap((p, j, all) => (j ? [all[j - 1], p] : [])));
    const segCol: number[] = [];
    curvePts.forEach((pts, i) => {
      const [ca, cb] = [colors[links[i][0]], colors[links[i][1]]];
      for (let j = 1; j < pts.length; j++)
        for (const t of [j - 1, j]) {
          const c = ca.clone().lerp(cb, t / 12);
          segCol.push(c.r, c.g, c.b);
        }
    });
    const synGeom = new THREE.BufferGeometry().setFromPoints(segs(links.map((_, i) => i)));
    synGeom.setAttribute("color", new THREE.Float32BufferAttribute(segCol, 3));
    const synMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.14, depthWrite: false });
    add(new THREE.LineSegments(synGeom, synMat));
    const synCount = synGeom.attributes.position.count;
    if (!still) synGeom.setDrawRange(0, 0); // wiring grows in during the intro
    const hiMat = new THREE.LineBasicMaterial({ color: 0xfff1fa, transparent: true, opacity: 0.55, depthWrite: false });
    const hiLines = add(new THREE.LineSegments(new THREE.BufferGeometry(), hiMat));

    // signals: small sparks that hop from neuron to neuron along real links
    const adjacency = nodes.map(() => [] as number[]);
    links.forEach(([a, b], i) => (adjacency[a].push(i), adjacency[b].push(i)));
    const sparks = Array.from({ length: still ? 0 : Math.min(64, links.length) }, () => ({
      link: Math.floor(Math.random() * links.length), forward: Math.random() < 0.5, t: Math.random(), speed: 0.004 + Math.random() * 0.008,
    }));
    const TRAIL = 3; // comet tail points behind each spark
    const sparkGeom = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(sparks.length * 3), 3));
    const trailGeom = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(sparks.length * TRAIL * 3), 3));
    const sparkPts = add(new THREE.Points(sparkGeom, glow(0.42, 0.9, 0xfff4fb)));
    const trailPts = add(new THREE.Points(trailGeom, glow(0.24, 0.35, 0xffc9ea)));
    sparkPts.frustumCulled = trailPts.frustumCulled = false;
    sparkPts.visible = trailPts.visible = false; // all sparks sit at the origin until the intro ends
    const flash = new Float32Array(nodes.length);

    // thought waves: a shockwave ring sweeps through the brain and lights every cell it passes
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd6f0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const ring = add(new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 128), ringMat));
    const wave = { origin: new THREE.Vector3(), t0: -99, max: 0, id: 0 };
    const waveHit = new Int32Array(nodes.length);
    let waveAt = 0; // "now" for startWave, set by the loop
    let nextWave = INTRO + 9;
    const startWave = (origin: THREE.Vector3, max: number) => {
      if (still) return;
      Object.assign(wave, { t0: waveAt, max, id: wave.id + 1 });
      wave.origin.copy(origin);
    };
    let lastTick = -9;

    // interaction
    const ray = new THREE.Raycaster();
    ray.params.Points = { threshold: 0.3 };
    const mouse = new THREE.Vector2(9, 9);
    let hovered = -1;
    let picked = -1;
    let emph: Set<number> | null = null;
    let down = { x: 0, y: 0 };
    let touched = false;
    let goal: { target: THREE.Vector3; dist: number } | null = null; // camera glide destination
    const activePick = () => {
      ray.setFromCamera(mouse, camera);
      const hit = ray
        .intersectObject(halos)
        .find((h) => h.index !== undefined && matchesAudience(nodes[h.index].audience, modeRef.current));
      return hit?.index ?? -1;
    };
    const setHover = (i: number) => {
      if (i === hovered) return;
      hovered = i;
      renderer.domElement.style.cursor = i >= 0 ? "pointer" : "grab";
      if (!emph) setLines(hiLines, i < 0 ? [] : segs(adjacency[i]));
      if (tip.current) {
        tip.current.textContent = i >= 0 ? `${nodes[i].title} · ${groupOf(nodes[i].folder).label}` : "";
        tip.current.style.opacity = i >= 0 ? "1" : "0";
      }
    };
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (tip.current) tip.current.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      touched = true;
      onMove(e);
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      setSelected(activePick());
    };
    const onStart = () => ((touched = true), (goal = null));
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    controls.addEventListener("start", onStart);

    const homeDist = () => Math.max(19, 15 / camera.aspect); // portrait phones need to stand further back to fit the brain
    const dim = new THREE.Color();
    scene3d.current = {
      select(i) {
        picked = i;
        if (i >= 0) (goal = { target: pos[i], dist: 12 }), startWave(pos[i], 7);
      },
      reset() {
        goal = { target: new THREE.Vector3(), dist: homeDist() };
      },
      spin(on) {
        controls.autoRotate = on && !still;
      },
      emphasize(set) {
        emph = set;
        colors.forEach((c, i) => shown[i].copy(c).multiplyScalar(set && !set.has(i) ? 0.12 : 1)); // the loop paints it
        synMat.opacity = set ? 0.04 : 0.14;
        hiMat.opacity = set && set.size > 40 ? 0.2 : 0.55;
        setLines(hiLines, set ? segs(links.flatMap(([a, b], i) => (set.has(a) && set.has(b) ? [i] : []))) : []);
      },
      pulse(indices) {
        if (!indices.length) return;
        indices.forEach((idx, rank) => {
          if (idx >= 0 && idx < nodes.length) flash[idx] = rank === 0 ? 1.8 : 1.35;
        });
        const primary = indices[0];
        if (primary >= 0 && primary < nodes.length) {
          startWave(live[primary], 14);
          if (!emph) {
            const pulseLinks = indices.flatMap((idx) => adjacency[idx] ?? []);
            setLines(hiLines, segs([...new Set(pulseLinks)]));
          }
        }
      },
    };

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const m = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const off = new THREE.Vector3();
    const clock = new THREE.Clock();
    const WHITE = new THREE.Color(0xffffff);
    const CORE = new THREE.Vector3(0, 0.4, 0);
    let frame = 0;
    let prevT = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      const f60 = Math.min(t - prevT, 0.1) * 60; // 60fps frames elapsed: motion follows real time on any refresh rate
      prevT = t;
      waveAt = t;
      // intro: glide in from far away until the visitor takes over
      const dist = camera.position.length();
      const home = homeDist();
      if (!touched && !goal && dist > home + 0.5) camera.position.multiplyScalar(1 - 0.035 * (1 - home / dist));
      if (goal) {
        tmp.subVectors(goal.target, controls.target).multiplyScalar(0.08);
        controls.target.add(tmp);
        off.subVectors(camera.position, controls.target).add(tmp);
        const len = off.length();
        camera.position.copy(controls.target).add(off.setLength(len + (goal.dist - len) * 0.08));
        if (tmp.lengthSq() < 1e-6 && Math.abs(len - goal.dist) < 0.05) goal = null;
      }
      controls.update();

      if (!introDone) {
        let landed = true;
        for (let i = 0; i < nodes.length; i++) {
          const k2 = clamp01((t - delay[i]) / 1.6);
          if (k2 < 1) landed = false;
          const e = easeOutCubic(k2);
          const a = (1 - e) * 2.6; // spiral that unwinds as the cell lands
          const p = pos[i];
          live[i].set(p.x * Math.cos(a) - p.z * Math.sin(a), p.y, p.x * Math.sin(a) + p.z * Math.cos(a)).multiplyScalar(e).addScaledVector(CORE, 1 - e);
          pop[i] = easeOutBack(k2);
          haloGeom.attributes.position.setXYZ(i, live[i].x, live[i].y, live[i].z);
        }
        haloGeom.attributes.position.needsUpdate = true;
        dust.material.opacity = 0.2 * clamp01(t / 2.5);
        synGeom.setDrawRange(0, Math.floor((synCount * clamp01((t - 1.6) / 1.8)) / 2) * 2);
        controls.autoRotateSpeed = 0.5 + 3 * clamp01(1 - t / INTRO); // spins up fast, settles as the brain forms
        if (landed && t > INTRO) {
          introDone = true;
          haloGeom.computeBoundingSphere(); // the raycaster tests against it
          synGeom.setDrawRange(0, Infinity);
          sparkPts.visible = trailPts.visible = true;
          startWave(CORE, 16); // the brain "wakes up"
        }
      }

      if (introDone && t > nextWave) (nextWave = t + 8 + Math.random() * 5), startWave(live[Math.floor(Math.random() * nodes.length)], 14);
      const r = (t - wave.t0) * 9;
      ringMat.opacity = r < wave.max ? 0.45 * (1 - r / wave.max) : 0;
      ring.visible = ringMat.opacity > 0;
      if (ring.visible) {
        ring.position.copy(wave.origin);
        ring.quaternion.copy(camera.quaternion); // always faces the viewer
        ring.scale.setScalar(Math.max(r, 0.01));
        for (let i = 0; i < nodes.length; i++)
          if (waveHit[i] !== wave.id && live[i].distanceTo(wave.origin) < r) (waveHit[i] = wave.id), (flash[i] = 1);
      }

      if (introDone) sparks.forEach((sp, i) => {
        sp.t += sp.speed * f60;
        if (sp.t >= 1) {
          const [a, b] = links[sp.link];
          const at = sp.forward ? b : a;
          flash[at] = 1;
          if (t - lastTick > 2.4 && stream.current && matchesAudience(nodes[at].audience, modeRef.current)) {
            lastTick = t;
            fired.current = at;
            stream.current.textContent = `${nodes[sp.forward ? a : b].title} → ${nodes[at].title}`;
            stream.current.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: "ease-out" });
          }
          const next = adjacency[at][Math.floor(Math.random() * adjacency[at].length)];
          sp.link = next ?? Math.floor(Math.random() * links.length);
          sp.forward = links[sp.link][0] === at;
          sp.t = 0;
        }
        const cv = curves[sp.link];
        cv.getPoint(sp.forward ? sp.t : 1 - sp.t, tmp);
        sparkGeom.attributes.position.setXYZ(i, tmp.x, tmp.y, tmp.z);
        for (let j = 1; j <= TRAIL; j++) {
          const back = Math.max(0, sp.t - j * 0.05);
          cv.getPoint(sp.forward ? back : 1 - back, tmp);
          trailGeom.attributes.position.setXYZ(i * TRAIL + j - 1, tmp.x, tmp.y, tmp.z);
        }
      });
      sparkGeom.attributes.position.needsUpdate = trailGeom.attributes.position.needsUpdate = true;

      setHover(activePick());

      const decay = 0.93 ** f60;
      for (let i = 0; i < nodes.length; i++) {
        flash[i] *= decay;
        const breathe = still ? 1 : 1 + 0.08 * Math.sin(t * 2 + i * 1.7);
        const size = baseSize[i] * pop[i] * breathe * (1 + 0.6 * flash[i]) * (i === hovered || i === picked ? 1.8 : 1);
        balls.setMatrixAt(i, m.compose(live[i], quat, s.set(size, size, size)));
        // a fired cell glows toward white; cells dimmed by a filter stay dim
        dim.copy(shown[i]).lerp(WHITE, emph && !emph.has(i) ? 0 : flash[i] * 0.7);
        balls.setColorAt(i, dim);
        haloCol.setXYZ(i, dim.r, dim.g, dim.b);
      }
      balls.instanceMatrix.needsUpdate = balls.instanceColor!.needsUpdate = haloCol.needsUpdate = true;
      stars.rotation.y = t * 0.01;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      scene3d.current = null;
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.removeEventListener("start", onStart);
      disposables.forEach((d) => d.dispose());
      hiLines.geometry.dispose();
      renderer.domElement.remove();
    };
  }, [nodes, links]);

  // what is lit: the picked cell + its neighbours, else search hits, else the chosen group, else active mode, else everything
  useEffect(() => {
    const modeMatch = (i: number) => matchesAudience(nodes[i].audience, mode);
    const set =
      selected >= 0
        ? new Set([selected, ...visibleNeighbors.map((nb) => nb.idx)])
        : needle
          ? new Set(matches)
          : group
            ? new Set(nodes.flatMap((n, i) => (n.folder === group && modeMatch(i) ? [i] : [])))
            : mode !== "all"
              ? new Set(nodes.flatMap((n, i) => (modeMatch(i) ? [i] : [])))
              : null;
    scene3d.current?.emphasize(set);
  }, [selected, visibleNeighbors, needle, matches, group, mode, nodes]);

  useEffect(() => scene3d.current?.select(selected), [selected]);
  useEffect(() => scene3d.current?.spin(spinning && selected < 0), [spinning, selected]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(-1);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const es = new EventSource("/mcp/events");
    let burstTimer: ReturnType<typeof setTimeout> | undefined;

    es.onopen = () => setTermLive(true);
    es.onerror = () => setTermLive(false);

    es.addEventListener("snapshot", (msg) => {
      try {
        const list = JSON.parse((msg as MessageEvent<string>).data) as McpCallEvent[];
        if (Array.isArray(list)) {
          const recent = list.slice(-25);
          setMcpLogs(recent);
          const newest = recent[recent.length - 1];
          if (newest && Date.now() - Date.parse(newest.ts) < 15_000) {
            setTermOpen(true);
          }
        }
      } catch {
        // ignore malformed snapshot
      }
    });

    es.addEventListener("mcp", (msg) => {
      try {
        const ev = JSON.parse((msg as MessageEvent<string>).data) as McpCallEvent;
        setMcpLogs((prev) => {
          const next = prev.some((x) => x.id === ev.id) ? prev : [...prev, ev];
          return next.slice(-25);
        });
        setTermOpen(true);
        setTermBurst(true);
        if (burstTimer) clearTimeout(burstTimer);
        burstTimer = setTimeout(() => setTermBurst(false), 900);

        const hitIndices = ev.hits
          .map((h) => slugIndex.get(h.slug))
          .filter((idx): idx is number => idx !== undefined);
        const pulseTargets = hitIndices.length ? hitIndices : nodes.length ? [0] : [];
        if (pulseTargets.length) {
          scene3d.current?.pulse(pulseTargets);
          fired.current = pulseTargets[0];
          if (stream.current) {
            const label = ev.hits[0]?.title ?? ev.arg;
            stream.current.textContent = `MCP ${ev.tool} → ${label}`;
          }
        }
      } catch {
        // ignore malformed event
      }
    });

    return () => {
      if (burstTimer) clearTimeout(burstTimer);
      es.close();
      setTermLive(false);
    };
  }, [slugIndex, nodes.length]);

  useEffect(() => {
    if (termOpen && termBodyRef.current) {
      termBodyRef.current.scrollTop = termBodyRef.current.scrollHeight;
    }
  }, [mcpLogs, termOpen]);

  const selectMode = (next: AudienceFilter) => {
    setMode(next);
    if (group && !matchesAudience(groupOf(group).audience, next)) setGroup(null);
    if (selected >= 0 && !matchesAudience(nodes[selected].audience, next)) setSelected(-1);
  };
  const pick = (i: number) => {
    if (i >= 0 && !matchesAudience(nodes[i].audience, mode)) setMode("all");
    setSelected(i);
    setQ("");
  };
  pickRef.current = pick;
  const reset = () => (setSelected(-1), setGroup(null), setQ(""), setMode("all"), scene3d.current?.reset());
  const resetTermRect = () => {
    setTermRect(null);
    try {
      localStorage.removeItem(TERM_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  };
  const startTermInteract = (modeType: "move" | ResizeDir, e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (modeType === "move" && (e.target as HTMLElement).closest("button")) return;
    const termEl = termRef.current;
    const hostEl = mount.current?.parentElement;
    if (!termEl || !hostEl) return;
    e.preventDefault();
    e.stopPropagation();

    const hostBox = hostEl.getBoundingClientRect();
    const box = termEl.getBoundingClientRect();
    const vw = hostBox.width;
    const vh = hostBox.height;
    const minW = Math.min(340, Math.max(260, vw - 16));
    const minH = Math.min(170, Math.max(140, vh - 16));
    const orig: TermRect = termRect ?? {
      x: Math.round(box.left - hostBox.left),
      y: Math.round(box.top - hostBox.top),
      w: Math.round(box.width),
      h: Math.round(box.height),
    };
    const startX = e.clientX;
    const startY = e.clientY;
    let latest = orig;
    setTermRect(orig);
    setTermDragging(true);

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (modeType === "move") {
        latest = clampTermRect({ x: orig.x + dx, y: orig.y + dy, w: orig.w, h: orig.h }, vw, vh);
      } else {
        let left = orig.x;
        let right = orig.x + orig.w;
        let top = orig.y;
        let bottom = orig.y + orig.h;
        if (modeType.includes("e")) right = Math.min(vw - 8, Math.max(left + minW, orig.x + orig.w + dx));
        if (modeType.includes("w")) left = Math.max(8, Math.min(right - minW, orig.x + dx));
        if (modeType.includes("s")) bottom = Math.min(vh - 8, Math.max(top + minH, orig.y + orig.h + dy));
        if (modeType.includes("n")) top = Math.max(8, Math.min(bottom - minH, orig.y + dy));
        latest = {
          x: Math.round(left),
          y: Math.round(top),
          w: Math.round(right - left),
          h: Math.round(bottom - top),
        };
      }
      setTermRect(latest);
    };

    const onEnd = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onEnd);
      target.removeEventListener("pointercancel", onEnd);
      setTermDragging(false);
      try {
        localStorage.setItem(TERM_STORAGE_KEY, JSON.stringify(latest));
      } catch {
        // ignore storage errors
      }
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onEnd);
    target.addEventListener("pointercancel", onEnd);
  };
  const triggerSampleMcp = async () => {
    if (testingMcp) return;
    setTestingMcp(true);
    try {
      const args =
        mode === "dev"
          ? { question: "ยอดคงเหลือสินค้า แยกตามคลังสินค้า", audience: "dev" }
          : mode === "user"
            ? { question: "เช็คเด้งต้องทำอย่างไร", audience: "user" }
            : { question: "ภาษีมูลค่าเพิ่ม ภ.พ.30 รายงานภาษีซื้อขาย", audience: "all" };
      await fetch("/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name: "ask_brain", arguments: args },
        }),
      });
    } finally {
      setTestingMcp(false);
    }
  };
  const sel = selected >= 0 ? nodes[selected] : null;
  const modeQuery = mode !== "all" ? `?mode=${mode}` : "";
  const searchPlaceholder =
    mode === "dev"
      ? "ค้นหาฝั่ง Dev เช่น ic_trans, gl_journal, trans_flag, MCP"
      : mode === "user"
        ? "ค้นหาเซลล์ เช่น ภาษีซื้อ, ตัดสต็อก, เช็ค"
        : "ค้นหาเซลล์ เช่น ภาษีซื้อ, ตัดสต็อก, ic_trans, gl_journal";

  return (
    <>
      <div className="brain" ref={mount}>
        <div className="brain-tip" ref={tip} aria-live="polite" />
        {failed && <p className="brain-fallback">เบราว์เซอร์นี้ไม่รองรับ WebGL — เปิดคลังความรู้จากปุ่มด้านบนได้เลย</p>}
      </div>

      <section className="hero">
        {children}
        <div className="mode-switch" role="group" aria-label="เลือกโซนความรู้">
          {MODE_OPTIONS.map(([m, label]) => (
            <button
              key={m}
              type="button"
              className="mode-btn"
              aria-pressed={mode === m}
              onClick={() => selectMode(m)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="actions">
          <Link className="btn primary" href={`/n${modeQuery}`}>
            เปิดคลังความรู้
          </Link>
          <a className="btn" href="#mcp">
            เชื่อม AI ผ่าน MCP
          </a>
        </div>
        <form
          className="brain-search"
          role="search"
          action="/n"
          onSubmit={(e) => {
            if (matches.length) (e.preventDefault(), pick(matches[0]));
          }}
        >
          {mode !== "all" && <input type="hidden" name="mode" value={mode} />}
          <input
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            placeholder={searchPlaceholder}
            aria-label="ค้นหาเซลล์ความรู้"
          />
          {needle && (
            <ul className="brain-suggest">
              {matches.slice(0, 7).map((i) => (
                <li key={i}>
                  <button type="button" onClick={() => pick(i)}>
                    <i className="dot" style={{ color: groupOf(nodes[i].folder).color }} />
                    {nodes[i].title}
                  </button>
                </li>
              ))}
              <li>
                <Link href={`/n?q=${encodeURIComponent(q.trim())}${mode !== "all" ? `&mode=${mode}` : ""}`}>
                  ค้นในเนื้อหาทั้งหมด “{q.trim()}” →
                </Link>
              </li>
            </ul>
          )}
        </form>
      </section>

      {sel && (
        <aside className="brain-card" aria-label="รายละเอียดเซลล์" key={selected}>
          <button className="brain-x" onClick={() => setSelected(-1)} aria-label="ปิด">
            ×
          </button>
          <p className="brain-card-group" style={{ color: groupOf(sel.folder).color }}>
            <i className="dot" />
            <span>{groupOf(sel.folder).label}</span>
            <span className={`chip zone zone-${sel.audience}`}>{ZONE_LABEL[sel.audience]}</span>
          </p>
          <h2>{sel.title}</h2>
          <Link className="btn primary" href={`/n/${encodeURIComponent(sel.slug)}${modeQuery}`}>
            อ่านโน้ตเต็ม →
          </Link>
          {visibleNeighbors.length > 0 && (
            <>
              <h3>เชื่อมกับ {visibleNeighbors.length} เซลล์ — แตะเพื่อไปต่อ</h3>
              <ul>
                {visibleNeighbors.map(({ idx: j, rel }, n) => (
                  <li key={j} style={{ "--i": n } as CSSProperties}>
                    <button onClick={() => setSelected(j)}>
                      <i className="dot" style={{ color: groupOf(nodes[j].folder).color }} />
                      <span className="brain-nb-label">{nodes[j].title}</span>
                      <span className="chip rel">{RELATION_LABEL[rel]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      )}

      {termOpen && (
        <aside
          ref={termRef}
          className={`mcp-term${termRect ? " is-custom" : ""}${termDragging ? " is-dragging" : ""}`}
          style={
            termRect
              ? { left: termRect.x, top: termRect.y, width: termRect.w, height: termRect.h }
              : undefined
          }
          data-burst={termBurst ? "true" : "false"}
          aria-label="MCP Terminal แบบเรียลไทม์ (ลากย้ายและปรับขนาดได้)"
        >
          {RESIZE_DIRS.map((dir) => (
            <span
              key={dir}
              className={`mcp-rz rz-${dir}`}
              aria-hidden="true"
              onPointerDown={(e) => startTermInteract(dir, e)}
            />
          ))}
          <div
            className="mcp-term-head"
            onPointerDown={(e) => startTermInteract("move", e)}
            onDoubleClick={resetTermRect}
            title="ลากเพื่อย้ายหน้าต่าง · ดับเบิลคลิกเพื่อคืนตำแหน่งเดิม"
          >
            <div className="mcp-term-title">
              <span className="mcp-dots" aria-hidden="true">
                <i className="d-red" />
                <i className="d-amber" />
                <i className="d-green" />
              </span>
              <b>MCP LIVE</b>
              <span className={`mcp-status${termLive ? " online" : ""}`}>
                {termLive ? "เชื่อมต่อแล้ว" : "กำลังเชื่อม…"}
              </span>
            </div>
            <div className="mcp-term-actions">
              <button type="button" className="mcp-mini-btn" onClick={triggerSampleMcp} disabled={testingMcp}>
                {testingMcp ? "กำลังยิง…" : "ยิงทดสอบ"}
              </button>
              <button type="button" className="mcp-mini-btn" onClick={() => setMcpLogs([])}>
                ล้าง
              </button>
              {termRect && (
                <button
                  type="button"
                  className="mcp-mini-btn"
                  onClick={resetTermRect}
                  aria-label="คืนตำแหน่งและขนาดเริ่มต้น"
                  title="คืนตำแหน่งและขนาดเริ่มต้น"
                >
                  ↺
                </button>
              )}
              <button
                type="button"
                className="mcp-mini-btn"
                onClick={() => setTermOpen(false)}
                aria-label="ย่อหน้าต่าง Terminal"
                title="ย่อหน้าต่าง"
              >
                —
              </button>
            </div>
          </div>
          <div className="mcp-term-body" ref={termBodyRef} role="log" aria-live="polite">
            {mcpLogs.length === 0 ? (
              <p className="mcp-empty">
                <span className="mcp-prompt">$</span> รอรับคำสั่งจาก AI ที่เรียก <code>/mcp</code> แบบสด... (กด &ldquo;ยิงทดสอบ&rdquo; เพื่อจำลองได้)
              </p>
            ) : (
              mcpLogs.map((ev) => (
                <div className="mcp-entry" key={ev.id}>
                  <div className="mcp-cmd">
                    <span className="mcp-time">{ev.time}</span>
                    <span className="mcp-prompt">$</span>
                    <code className="mcp-tool">{ev.tool}</code>
                    <span className={`mcp-aud aud-${ev.audience}`}>{ev.audience}</span>
                    <span className="mcp-arg">&ldquo;{ev.arg}&rdquo;</span>
                    <span className="mcp-ms">{ev.ms} ms</span>
                  </div>
                  <div className="mcp-out">
                    <span className="mcp-arrow">↳</span>
                    <span className="mcp-found">
                      {ev.totalHits > 0 ? `พบ ${ev.totalHits} โน้ต` : "ไม่พบโน้ตที่ตรง"}
                    </span>
                    {ev.hits.map((h) => {
                      const idx = slugIndex.get(h.slug);
                      return (
                        <button
                          key={h.slug}
                          type="button"
                          className="mcp-hit-btn"
                          style={{ color: groupOf(h.folder).color }}
                          onClick={() => idx !== undefined && pickRef.current(idx)}
                          title={`ไปที่เซลล์: ${h.title} (${h.slug})`}
                        >
                          <i className="dot" />
                          <span>{h.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      <div className="brain-ctrl">
        <button
          type="button"
          className={`btn mcp-toggle${termOpen ? " is-open" : ""}`}
          aria-pressed={termOpen}
          onClick={() => setTermOpen((v) => !v)}
        >
          <i className={`mcp-led${termLive ? " on" : ""}`} />
          <span>MCP Terminal</span>
          {mcpLogs.length > 0 && <span className="mcp-count">{mcpLogs.length}</span>}
        </button>
        <button className="btn" onClick={() => setSpinning(!spinning)}>
          {spinning ? "หยุดหมุน" : "หมุนต่อ"}
        </button>
        <button className="btn" onClick={reset}>
          มุมเริ่มต้น
        </button>
      </div>

      <div className="brain-bottom">
        <button className="brain-stream" ref={stream} title="สัญญาณล่าสุดที่วิ่งระหว่างเซลล์ — แตะเพื่อไปดู" onClick={() => fired.current >= 0 && pick(fired.current)} />
        <p className="hint">ลากเพื่อหมุน · ล้อเมาส์เพื่อซูม · คลิกเซลล์เพื่อดูรายละเอียด · กดกลุ่มเพื่อกรอง</p>
        <div className="brain-groups" role="group" aria-label="กรองตามกลุ่มความรู้">
          {groups.map(([f, n], idx) => (
            <button
              key={f}
              aria-pressed={group === f}
              style={{ color: groupOf(f).color, "--i": idx } as CSSProperties}
              onClick={() => (setSelected(-1), setGroup(group === f ? null : f))}
            >
              <i className="dot" />
              <b>{groupOf(f).label}</b>
              <span>{n}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
