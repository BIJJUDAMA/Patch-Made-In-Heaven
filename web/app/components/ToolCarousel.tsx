"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

interface Tool {
  num: string;
  name: string;
  tag: string;
  desc: string;
}

interface Props {
  tools: Tool[];
}

// ── Draw a single card onto a canvas ──────────────────────────────────────────
function drawCard(tool: Tool, focused: boolean): HTMLCanvasElement {
  const W = 520, H = 780;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, focused ? "#231b2e" : "#131016");
  bg.addColorStop(1, focused ? "#0e0b12" : "#080709");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Top accent bar
  const accent = ctx.createLinearGradient(0, 0, W, 0);
  accent.addColorStop(0, "#403548");
  accent.addColorStop(0.5, "#81728c");
  accent.addColorStop(1, "#403548");
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 3);

  // Subtle corner mark
  ctx.strokeStyle = focused ? "rgba(129,114,140,0.55)" : "rgba(129,114,140,0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // Number
  ctx.font = '500 22px "SF Mono", "Courier New", monospace';
  ctx.fillStyle = "#81728c";
  ctx.fillText(tool.num, 44, 68);

  // Tag — right side
  ctx.font = '500 18px "SF Mono", "Courier New", monospace';
  ctx.fillStyle = focused ? "rgba(201,168,118,0.75)" : "rgba(129,114,140,0.5)";
  const tagW = ctx.measureText(tool.tag).width;
  ctx.fillText(tool.tag, W - 44 - tagW, 68);

  // Hairline separator below num/tag
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(44, 90);
  ctx.lineTo(W - 44, 90);
  ctx.stroke();

  // Tool name — italic serif, large
  const nameLines = tool.name.split("_");
  ctx.font = 'italic 500 52px "Playfair Display", "Georgia", serif';
  ctx.fillStyle = focused ? "#e8e2da" : "#c4bdb6";
  let nameY = 170;
  for (const line of nameLines) {
    ctx.fillText(line + (nameLines.indexOf(line) < nameLines.length - 1 ? "_" : ""), 44, nameY);
    nameY += 60;
  }

  // Short gold rule
  const ruleY = nameY + 20;
  ctx.strokeStyle = focused ? "rgba(201,168,118,0.65)" : "rgba(129,114,140,0.3)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(44, ruleY);
  ctx.lineTo(96, ruleY);
  ctx.stroke();

  // Description — mono, small
  const descY = ruleY + 44;
  ctx.font = '400 17px "SF Mono", "Courier New", monospace';
  ctx.fillStyle = focused ? "rgba(216,209,203,0.7)" : "rgba(180,175,170,0.45)";
  const words = tool.desc.split(" ");
  let line = "";
  let lineY = descY;
  const maxW = W - 88;
  const lineH = 28;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, 44, lineY);
      line = word;
      lineY += lineH;
      if (lineY > H - 100) break;
    } else {
      line = test;
    }
  }
  if (line && lineY <= H - 100) ctx.fillText(line, 44, lineY);

  // Bottom arrow
  ctx.font = '400 22px "SF Mono", "Courier New", monospace';
  ctx.fillStyle = focused ? "rgba(201,168,118,0.7)" : "rgba(129,114,140,0.25)";
  ctx.fillText("→", W - 68, H - 52);

  return canvas;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ToolCarousel({ tools }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const init = useCallback(() => {
    const container = mountRef.current;
    if (!container) return;

    const W = container.clientWidth;
    const H = Math.max(480, Math.min(600, W * 0.42));

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;";

    // ── Scene / Camera ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 60);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xd8d1cb, 0.4);
    dirLight.position.set(3, 4, 5);
    scene.add(dirLight);

    // ── Cards ────────────────────────────────────────────────────────────────
    const N = tools.length;
    const RADIUS = 4.2;
    const CARD_W = 2.1;
    const CARD_H = 3.15;
    const geo = new THREE.PlaneGeometry(CARD_W, CARD_H, 1, 1);

    const meshes: THREE.Mesh[] = [];
    const textures: THREE.CanvasTexture[] = [];

    // Build two texture sets: default + focused
    const canvasesDefault = tools.map((t) => drawCard(t, false));
    const canvasFocused   = tools.map((t) => drawCard(t, true));

    const texDefault = canvasesDefault.map((c) => new THREE.CanvasTexture(c));
    const texFocused = canvasFocused.map((c) => new THREE.CanvasTexture(c));

    tools.forEach((_, i) => {
      const angle = (i / N) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({
        map: texDefault[i],
        transparent: true,
        opacity: 0,
        side: THREE.FrontSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        Math.sin(angle) * RADIUS,
        0,
        Math.cos(angle) * RADIUS
      );
      mesh.rotation.y = angle;
      scene.add(mesh);
      meshes.push(mesh);
      textures.push(texDefault[i]);
    });

    // ── Interaction ──────────────────────────────────────────────────────────
    let theta = 0;
    let velocity = 0;
    let dragging = false;
    let lastX = 0;
    let lastFront = -1;

    const getFront = () => {
      let best = 0, bestZ = -Infinity;
      meshes.forEach((m, i) => {
        const angle = (i / N) * Math.PI * 2;
        const z = Math.cos(angle + theta);
        if (z > bestZ) { bestZ = z; best = i; }
      });
      return best;
    };

    const onDown = (clientX: number) => { dragging = true; lastX = clientX; };
    const onMove = (clientX: number) => {
      if (!dragging) return;
      const dx = clientX - lastX;
      lastX = clientX;
      velocity = dx * 0.007;
      theta += dx * 0.007;
    };
    const onUp = () => { dragging = false; };

    const mouseDown = (e: MouseEvent) => onDown(e.clientX);
    const mouseMove = (e: MouseEvent) => onMove(e.clientX);
    const mouseUp   = () => onUp();
    const touchDown = (e: TouchEvent) => onDown(e.touches[0].clientX);
    const touchMove = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX); };
    const touchUp   = () => onUp();
    const wheel     = (e: WheelEvent) => { e.preventDefault(); velocity -= e.deltaY * 0.003; };

    renderer.domElement.addEventListener("mousedown",  mouseDown);
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup",   mouseUp);
    renderer.domElement.addEventListener("touchstart", touchDown, { passive: true });
    renderer.domElement.addEventListener("touchmove",  touchMove, { passive: false });
    renderer.domElement.addEventListener("touchend",   touchUp);
    renderer.domElement.addEventListener("wheel",      wheel,     { passive: false });

    // ── Cursor ───────────────────────────────────────────────────────────────
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("mousedown", () => {
      renderer.domElement.style.cursor = "grabbing";
    });
    window.addEventListener("mouseup", () => {
      renderer.domElement.style.cursor = "grab";
    });

    // ── Animation ────────────────────────────────────────────────────────────
    let raf: number;
    const clock = new THREE.Clock();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);

      if (!dragging) {
        theta += velocity * dt * 60;
        velocity *= Math.exp(-3.5 * dt);
        // Idle drift
        velocity += 0.0006;
      }

      const front = getFront();

      meshes.forEach((mesh, i) => {
        const angle = (i / N) * Math.PI * 2 + theta;
        mesh.position.x = Math.sin(angle) * RADIUS;
        mesh.position.z = Math.cos(angle) * RADIUS;
        mesh.rotation.y = angle;

        const depth = (Math.cos(angle) + 1) * 0.5; // 0=back, 1=front
        const isFront = i === front;
        const targetOpacity = 0.2 + depth * 0.8;
        const targetScale   = 0.72 + depth * 0.28;
        const mat = mesh.material as THREE.MeshBasicMaterial;

        mat.opacity += (targetOpacity - mat.opacity) * Math.min(1, dt * 5);
        mesh.scale.x += (targetScale - mesh.scale.x) * Math.min(1, dt * 5);
        mesh.scale.y = mesh.scale.x;

        // Swap texture on focus change
        if (isFront && lastFront !== front) {
          mat.map = texFocused[i];
          mat.needsUpdate = true;
        } else if (!isFront && lastFront === i) {
          mat.map = texDefault[i];
          mat.needsUpdate = true;
        }
      });

      lastFront = front;
      renderer.render(scene, camera);
    };
    tick();

    // ── Resize ───────────────────────────────────────────────────────────────
    const onResize = () => {
      const nW = container.clientWidth;
      const nH = Math.max(480, Math.min(600, nW * 0.42));
      renderer.setSize(nW, nH);
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ── Cleanup ──────────────────────────────────────────────────────────────
    cleanupRef.current = () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("mousedown",  mouseDown);
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup",   mouseUp);
      renderer.domElement.removeEventListener("touchstart", touchDown);
      renderer.domElement.removeEventListener("touchmove",  touchMove);
      renderer.domElement.removeEventListener("touchend",   touchUp);
      renderer.domElement.removeEventListener("wheel",      wheel);
      window.removeEventListener("resize", onResize);
      texDefault.forEach((t) => t.dispose());
      texFocused.forEach((t) => t.dispose());
      geo.dispose();
      meshes.forEach((m) => (m.material as THREE.MeshBasicMaterial).dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [tools]);

  useEffect(() => {
    init();
    return () => cleanupRef.current?.();
  }, [init]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "520px", position: "relative", cursor: "grab" }}
      aria-label="Tool carousel — drag to rotate"
    />
  );
}
