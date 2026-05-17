import { useEffect, useRef } from "react";
import * as THREE from "three";
import { liquidFragmentShader, liquidVertexShader } from "./liquidGradientShaders";

/** Траектория курсора → текстура смещения (как в CodePen) */
class TouchTexture {
  size = 64;
  width: number;
  height: number;
  maxAge = 64;
  radius: number;
  speed: number;
  trail: Array<{
    x: number;
    y: number;
    age: number;
    force: number;
    vx: number;
    vy: number;
  }> = [];
  last: { x: number; y: number } | null = null;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;

  constructor() {
    this.width = this.height = this.size;
    this.radius = 0.17 * this.size;
    this.speed = 1 / this.maxAge;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D context");
    this.ctx = ctx;
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
  }

  update() {
    this.clear();
    const speed = this.speed;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const point = this.trail[i];
      if (!point) continue;
      let f = point.force * speed * (1 - point.age / this.maxAge) * 0.45;
      point.x += point.vx * f;
      point.y += point.vy * f;
      point.age++;
      if (point.age > this.maxAge) {
        this.trail.splice(i, 1);
      } else {
        this.drawPoint(point);
      }
    }
    this.texture.needsUpdate = true;
  }

  clear() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addTouch(point: { x: number; y: number }) {
    let force = 0;
    let vx = 0;
    let vy = 0;
    const last = this.last;
    if (last) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx === 0 && dy === 0) return;
      const dd = dx * dx + dy * dy;
      if (dd < 4e-8) return;
      const d = Math.sqrt(dd);
      vx = dx / d;
      vy = dy / d;
      force = Math.min(dd * 4800, 0.42);
    }
    this.last = { x: point.x, y: point.y };
    this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
  }

  drawPoint(point: {
    x: number;
    y: number;
    age: number;
    force: number;
    vx: number;
    vy: number;
  }) {
    const pos = {
      x: point.x * this.width,
      y: (1 - point.y) * this.height,
    };

    let intensity = 1;
    if (point.age < this.maxAge * 0.3) {
      intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
    } else {
      const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
      intensity = -t * (t - 2);
    }
    intensity *= point.force;

    const radius = this.radius;
    const color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255}, ${intensity * 255}`;
    const offset = this.size * 5;
    this.ctx.shadowOffsetX = offset;
    this.ctx.shadowOffsetY = offset;
    this.ctx.shadowBlur = radius * 0.75;
    this.ctx.shadowColor = `rgba(${color},${0.1 * intensity})`;

    this.ctx.beginPath();
    this.ctx.fillStyle = "rgba(255,0,0,1)";
    this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  dispose() {
    this.texture.dispose();
  }
}

type BgTheme = "light" | "dark";

function readBgTheme(): BgTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Палитра шейдера под тёмную / бело-небесную светлую тему */
function paletteForTheme(theme: BgTheme) {
  if (theme === "light") {
    return {
      sceneBg: 0xf7fbff,
      base: new THREE.Vector3(247 / 255, 251 / 255, 255 / 255),
      glowTopLeft: new THREE.Vector3(224 / 255, 242 / 255, 255 / 255),
      glowBottomRight: new THREE.Vector3(186 / 255, 230 / 255, 253 / 255),
      glowMid: new THREE.Vector3(205 / 255, 236 / 255, 255 / 255),
      speed: 0.65,
      intensity: 1.25,
      grain: 0.005,
    };
  }
  return {
    sceneBg: 0x06070b,
    base: new THREE.Vector3(6 / 255, 7 / 255, 11 / 255),
    glowTopLeft: new THREE.Vector3(15 / 255, 21 / 255, 38 / 255),
    glowBottomRight: new THREE.Vector3(11 / 255, 17 / 255, 30 / 255),
    glowMid: new THREE.Vector3(13 / 255, 19 / 255, 34 / 255),
    speed: 0.85,
    intensity: 1.55,
    grain: 0.008,
  };
}

class LiquidGradientRuntime {
  private disposed = false;
  private paused = false;
  private raf = 0;
  private readonly clock = new THREE.Clock();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;
  private readonly touchTexture: TouchTexture;
  private mesh: THREE.Mesh | null = null;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly onResizeBound: () => void;
  private readonly onPointerMoveBound: (ev: PointerEvent) => void;

  constructor(private readonly mount: HTMLElement) {
    this.touchTexture = new TouchTexture();
    const initial = paletteForTheme(readBgTheme());

    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uColor1: { value: initial.glowTopLeft.clone() },
      uColor2: { value: initial.glowBottomRight.clone() },
      uColor3: { value: initial.glowMid.clone() },
      uColor4: { value: initial.glowTopLeft.clone() },
      uColor5: { value: initial.glowBottomRight.clone() },
      uColor6: { value: initial.glowMid.clone() },
      uSpeed: { value: initial.speed },
      uIntensity: { value: initial.intensity },
      uTouchTexture: { value: this.touchTexture.texture },
      uGrainIntensity: { value: initial.grain },
      uDarkNavy: { value: initial.base.clone() },
      uGradientSize: { value: 0.58 },
      uGradientCount: { value: 12.0 },
      uColor1Weight: { value: 0.95 },
      uColor2Weight: { value: 1.05 },
    };

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
      depth: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;";
    mount.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.camera.position.z = 50;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(initial.sceneBg);

    const viewSize = this.getViewSize();
    const geometry = new THREE.PlaneGeometry(viewSize.width, viewSize.height, 1, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: liquidVertexShader,
      fragmentShader: liquidFragmentShader,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.z = 0;
    this.scene.add(this.mesh);

    this.onResizeBound = () => this.onResize();
    this.onPointerMoveBound = (ev: PointerEvent) => this.onPointerMove(ev);
    window.addEventListener("resize", this.onResizeBound);
    window.addEventListener("pointermove", this.onPointerMoveBound, { passive: true });

    this.onResize();
    this.tick();
  }

  setTheme(theme: BgTheme) {
    if (this.disposed) return;
    const p = paletteForTheme(theme);
    (this.uniforms.uColor1.value as THREE.Vector3).copy(p.glowTopLeft);
    (this.uniforms.uColor2.value as THREE.Vector3).copy(p.glowBottomRight);
    (this.uniforms.uColor3.value as THREE.Vector3).copy(p.glowMid);
    (this.uniforms.uColor4.value as THREE.Vector3).copy(p.glowTopLeft);
    (this.uniforms.uColor5.value as THREE.Vector3).copy(p.glowBottomRight);
    (this.uniforms.uColor6.value as THREE.Vector3).copy(p.glowMid);
    (this.uniforms.uDarkNavy.value as THREE.Vector3).copy(p.base);
    this.uniforms.uSpeed.value = p.speed;
    this.uniforms.uIntensity.value = p.intensity;
    this.uniforms.uGrainIntensity.value = p.grain;
    this.scene.background = new THREE.Color(p.sceneBg);
    this.renderFrame();
  }

  setPaused(paused: boolean) {
    if (this.disposed) return;
    this.paused = paused;
    if (paused) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.renderFrame();
    } else if (this.raf === 0) {
      this.tick();
    }
  }

  private renderFrame() {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  private getViewSize() {
    const fovInRadians = (this.camera.fov * Math.PI) / 180;
    const height = Math.abs(this.camera.position.z * Math.tan(fovInRadians / 2) * 2);
    return { width: height * this.camera.aspect, height };
  }

  private onPointerMove(ev: PointerEvent) {
    if (this.disposed || this.paused) return;
    const x = ev.clientX / window.innerWidth;
    const y = 1 - ev.clientY / window.innerHeight;
    this.touchTexture.addTouch({ x, y });
  }

  private onResize() {
    if (this.disposed) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.uniforms.uResolution.value.set(w, h);

    const viewSize = this.getViewSize();
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(viewSize.width, viewSize.height, 1, 1);
    }
  }

  private tick = () => {
    if (this.disposed) return;
    if (this.paused) {
      this.raf = 0;
      return;
    }
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.touchTexture.update();
    if (this.uniforms.uTime) {
      this.uniforms.uTime.value += delta;
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResizeBound);
    window.removeEventListener("pointermove", this.onPointerMoveBound);
    if (this.mesh) {
      this.mesh.geometry.dispose();
      const mat = this.mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    this.touchTexture.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.mount) {
      this.mount.removeChild(this.renderer.domElement);
    }
  }
}

/** Интерактивный «жидкий» градиент на Three.js — идея и шейдеры: https://codepen.io/cameronknight/pen/ogxWmBP */
export function LiquidGradientBackground({ paused = false }: { paused?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<LiquidGradientRuntime | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      runtimeRef.current = new LiquidGradientRuntime(el);
    } catch {
      /* WebGL недоступен */
    }
    const root = document.documentElement;
    const syncTheme = () => runtimeRef.current?.setTheme(readBgTheme());
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      observer.disconnect();
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.setPaused(paused);
  }, [paused]);

  return <div ref={ref} className="liquid-gradient-bg" aria-hidden />;
}
