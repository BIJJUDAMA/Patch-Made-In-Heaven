"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

export interface ToolItem {
  num: string;
  name: string;
  tag: string;
  desc: string;
  schema?: Record<string, any>;
}

interface Props {
  tools: ToolItem[];
  onSelectTool?: (tool: ToolItem) => void;
}

// ── Draw Card Canvas Texture (Optimized 600x600 size for fast GPU uploads) ──
function createToolCardTexture(tool: ToolItem): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext("2d")!;

  // Deep Obsidian High-Contrast Background
  const bg = ctx.createLinearGradient(0, 0, 600, 600);
  bg.addColorStop(0, "#1a1a1a");
  bg.addColorStop(0.4, "#0f0f0f");
  bg.addColorStop(1, "#030303");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 600, 600);

  // Crisp Linear Grid Overlay
  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 600; i += 45) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 225, 600);
    ctx.stroke();
  }

  // Sharp Inner Silver Border Frame
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 2.2;
  ctx.strokeRect(20, 20, 560, 560);

  // Number Badge (#ffffff White)
  ctx.font = '700 32px "Geist Mono", "JetBrains Mono", monospace';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`/ ${tool.num}`, 50, 80);

  // Tag Pill (#d4d4d8 Bright Silver-Gray)
  ctx.font = '600 20px "Geist Mono", "JetBrains Mono", monospace';
  ctx.fillStyle = "#d4d4d8";
  const tagWidth = ctx.measureText(tool.tag).width;
  ctx.fillText(tool.tag, 550 - tagWidth, 76);

  // Tool Title (Syne Display Font, #ffffff Crisp White)
  ctx.font = '800 48px "Syne", system-ui, sans-serif';
  ctx.fillStyle = "#ffffff";

  const titleWords = tool.name.split("_");
  let y = 195;
  for (const word of titleWords) {
    ctx.fillText(word, 50, y);
    y += 54;
  }

  // White Accent Line
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(50, y + 8, 95, 3.5);

  // Description (DM Sans Body Font, #e4e4e7 High-Contrast Light Gray)
  y += 54;
  ctx.font = '400 23px "DM Sans", system-ui, sans-serif';
  ctx.fillStyle = "#e4e4e7";

  const words = tool.desc.split(" ");
  let line = "";
  const maxWidth = 500;
  const lineHeight = 34;

  for (const word of words) {
    const testLine = line + word + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== "") {
      ctx.fillText(line, 50, y);
      line = word + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 50, y);

  // Footer (#ffffff Pure White)
  ctx.font = '700 17px "Geist Mono", "JetBrains Mono", monospace';
  ctx.fillStyle = "#ffffff";
  ctx.fillText("MCP TOOL →", 50, 538);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

// ── Shaders ──────────────────────────────────────────────────────────────────
const cardVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vBitangent;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vTangent = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
    vBitangent = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const cardFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uHolo;
  uniform float uFocus;
  uniform float uOpen;
  uniform float uFacetScale;
  uniform float uFacetStrength;
  uniform float uSeed;
  uniform vec2 uPointer;
  uniform float uTheta;
  uniform float uMotion;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vBitangent;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  vec2 hash2(vec2 p) {
    return fract(sin(vec2(
      dot(p, vec2(127.1, 311.7)),
      dot(p, vec2(269.5, 183.3))
    )) * 43758.5453);
  }

  vec3 cosPalette(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
  }

  vec3 diamondPalette(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  vec3 voronoi(vec2 g, out vec2 cellId) {
    vec2 ci = floor(g);
    vec2 cf = fract(g);
    float F1 = 8.0;
    float F2 = 8.0;
    cellId = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 n = vec2(float(x), float(y));
        vec2 p = hash2(ci + n);
        float d = length(n + p - cf);
        if (d < F1) { F2 = F1; F1 = d; cellId = ci + n; }
        else if (d < F2) { F2 = d; }
      }
    }
    return vec3(F1, F2, F2 - F1);
  }

  void main() {
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 N = normalize(vNormal);
    bool backFace = !gl_FrontFacing;
    if (backFace) N = -N;

    mat2 rot = mat2(0.7071, -0.7071, 0.7071, 0.7071);
    vec2 suv = rot * vUv;
    vec2 cellId;
    vec3 vor = voronoi(suv * uFacetScale * vec2(1.0, 0.75) + uSeed, cellId);
    vec2 cellId2;
    vec3 vor2 = voronoi(suv * uFacetScale * vec2(2.1, 1.6) + 13.7 + uSeed, cellId2);

    vec2 rnd = hash2(cellId + 7.3) - 0.5;
    vec3 Nf = normalize(N + (rnd.x * vTangent + rnd.y * vBitangent) * uFacetStrength);

    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    float holo = uHolo * (0.55 + 0.45 * uFocus) * (1.0 - 0.75 * uOpen);
    holo *= 1.0 + uMotion * (0.5 + 1.2 * uFocus);

    float centerMask = smoothstep(0.12, 0.52, length(vUv - 0.5));
    holo *= mix(0.4, 1.0, centerMask);

    float cycle = fract(uTime * 0.32);
    float diag = (1.0 - vUv.y) * 0.72 + vUv.x * 0.28;
    float sweepPos = cycle * 3.4 - 1.2;
    float sweepD = abs(diag - sweepPos);
    float sweep = exp(-pow(sweepD * 7.0, 2.0));
    float sweepCore = exp(-pow(sweepD * 18.0, 2.0));
    float sweepFringe = max(sweep - sweepCore, 0.0);

    float facing = pow(max(dot(N, V), 0.0), 3.0);
    float bandBase = dot(V, Nf) + sweep * 0.45 + uTheta * (1.2 + 2.4 * facing);
    float band = bandBase + dot(uPointer, rnd * 2.0) * 0.55 * uFocus;
    float n1 = noise(vUv * 3.0 + uSeed + uTime * 0.09);
    float n2 = noise(vUv * 4.5 + uSeed - uTime * 0.075 + n1 * 1.8);
    float flow = n1 + n2;
    float hue = flow * 0.85 + band * 1.9 + hash(cellId) * 0.25 + uTime * 0.03;
    vec3 iri = cosPalette(hue);
    iri = mix(iri, diamondPalette(hue), sweep * 0.6);
    iri = mix(vec3(1.0), iri, 0.55);

    float liquid = pow(0.5 + 0.5 * sin(flow * 4.0 + bandBase * 9.0 + uTime * 0.4), 2.0);
    float gleam = pow(0.5 + 0.5 * sin(hash(cellId) * 6.28318 + bandBase * 6.0 + uTime * 0.12), 3.0);
    float gleam2 = pow(0.5 + 0.5 * sin(hash(cellId2) * 6.28318 - bandBase * 5.0 + uTime * 0.09), 4.0);

    float fw = 0.028;
    vec2 edge = min(vUv, 1.0 - vUv);
    float edgeD = min(edge.x, edge.y);
    float frame = 1.0 - smoothstep(fw, fw + 0.004, edgeD);
    float bevel = 0.5 + 0.5 * cos((edgeD / fw) * 6.28318);

    vec3 image = texture2D(uMap, vUv).rgb;

    float luma = dot(image, vec3(0.299, 0.587, 0.114));
    image = mix(vec3(luma), image, 1.1);
    image = clamp(mix(vec3(0.5), image, 1.07), 0.0, 1.0);

    vec3 L = normalize(vec3(0.4, 0.7, 0.6));
    float glass = pow(max(dot(reflect(-L, Nf), V), 0.0), 22.0);

    if (backFace) {
      image = vec3(0.04, 0.04, 0.04) + iri * 0.1;
    }

    float focusHoloDampen = (1.0 - 0.45 * uFocus);
    float focusImageBoost = 1.05 + 0.5 * uFocus;

    vec3 crystal = mix(iri, vec3(0.9, 0.9, 0.9), 0.5);
    vec3 iceGleam = mix(iri, vec3(0.8, 0.8, 0.8), 0.45);
    vec3 imgTint = 0.25 + 0.75 * image;
    vec3 iriChroma = iri - dot(iri, vec3(0.299, 0.587, 0.114));
    vec3 color = image * focusImageBoost
               + iriChroma * liquid * (0.15 + 0.15 * sweep) * holo * focusHoloDampen
               + iri * liquid * (0.03 + 0.03 * sweep) * holo * focusHoloDampen
               + iceGleam * imgTint * gleam * (0.08 + 0.12 * sweep) * holo * focusHoloDampen
               + iceGleam * imgTint * gleam2 * (0.04 + 0.08 * sweep) * holo * focusHoloDampen
               + crystal * glass * (0.12 + 0.2 * sweep) * holo
               + iri * fres * (0.12 + 0.08 * sweep) * holo;

    vec2 pUv = uPointer * 0.5 + 0.5;
    float sheen = exp(-dot(vUv - pUv, vUv - pUv) * 6.0) * uFocus * (1.0 - uOpen);
    color += crystal * sheen * 0.15;

    float metalSheen = pow(0.5 + 0.5 * sin((vUv.x - vUv.y) * 5.0 + bandBase * 3.0 + uTime * 0.3), 8.0);
    vec3 silver = mix(vec3(0.3, 0.3, 0.3), vec3(0.95, 0.95, 0.95), bevel);
    silver *= 0.88 + 0.35 * fres;
    silver += iri * metalSheen * 0.9;
    silver += iri * 0.07;
    silver += vec3(0.95, 0.95, 0.95) * sweepCore * 0.45 * holo;
    silver += iri * sweepFringe * 0.15 * holo;
    silver += crystal * sheen * 0.25;
    color = mix(color, silver, frame * 0.95);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const flatVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export default function DiamondGallery({ tools, onSelectTool }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedTool, setExpandedTool] = useState<ToolItem | null>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [activeTab, setActiveTab] = useState<"params" | "schema">("params");

  const stateRef = useRef({
    theta: 0,
    velocity: 0,
    dragging: false,
    downX: 0,
    downY: 0,
    lastX: 0,
    state: "closed",
    openedCard: null as THREE.Mesh | null,
    currentFront: null as THREE.Mesh | null,
    stepCard: (_dir: number) => {},
    goToCard: (_idx: number) => {},
    openCard: (_card: THREE.Mesh) => {},
    closeCard: () => {},
  });

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    const CARD_COUNT = tools.length;
    const RADIUS = 4.3;
    const CARD_HEIGHT = 2.7;
    const CAMERA_Z = 11;
    const OPEN_DISTANCE = 5;

    const isMobile = window.innerWidth < 768;

    const params = {
      bloomStrength: 0.08,
      bloomRadius: 0.3,
      bloomThreshold: 0.88,
      holo: 1.0,
      facetScale: 18.0,
      facetStrength: 0.3,
      aberration: 0.001,
      floorReflect: 0.5,
      floorGlow: 0.55,
    };

    // Scene setup - Pure Black background matching --bg-app (#000000)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, CAMERA_Z);
    camera.lookAt(0, 0, 0);

    const fitCameraDistance = () => {
      camera.position.z = camera.aspect < 0.75 ? 15 : CAMERA_Z;
    };
    fitCameraDistance();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.25));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // Load custom textures for tools
    const textures = tools.map((t) => createToolCardTexture(t));

    // Carousel Group
    const carousel = new THREE.Group();
    scene.add(carousel);

    const cardGeometry = new THREE.PlaneGeometry(CARD_HEIGHT, CARD_HEIGHT);
    const cards: THREE.Mesh[] = [];
    const pointerSmooth = new THREE.Vector2();

    for (let i = 0; i < CARD_COUNT; i++) {
      const angle = (i / CARD_COUNT) * Math.PI * 2;
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: textures[i] },
          uTime: { value: 0 },
          uHolo: { value: params.holo },
          uFocus: { value: 0 },
          uOpen: { value: 0 },
          uFacetScale: { value: params.facetScale },
          uFacetStrength: { value: params.facetStrength },
          uSeed: { value: Math.random() * 100 },
          uPointer: { value: pointerSmooth },
          uTheta: { value: 0 },
          uMotion: { value: 0 },
        },
        vertexShader: cardVertexShader,
        fragmentShader: cardFragmentShader,
        side: THREE.DoubleSide,
      });

      const card = new THREE.Mesh(cardGeometry, material);
      card.position.set(Math.sin(angle) * RADIUS, 0, Math.cos(angle) * RADIUS);
      card.rotation.y = angle;
      card.userData = {
        index: i,
        tool: tools[i],
        angle,
        phase: Math.random() * Math.PI * 2,
        basePos: card.position.clone(),
        focus: 0,
      };
      carousel.add(card);
      cards.push(card);
    }

    // Platform Reflector floor
    const FLOOR_Y = -1.62;
    const FLOOR_R = 5.6;

    const mirror = new Reflector(new THREE.CircleGeometry(FLOOR_R, isMobile ? 48 : 72), {
      clipBias: 0.003,
      textureWidth: isMobile ? 512 : 1024,
      textureHeight: isMobile ? 512 : 1024,
      color: 0x121212,
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = FLOOR_Y;
    scene.add(mirror);

    const floorFade = new THREE.Mesh(
      new THREE.CircleGeometry(FLOOR_R + 0.05, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uStrength: { value: params.floorReflect } },
        vertexShader: flatVertexShader,
        fragmentShader: /* glsl */ `
          uniform float uStrength;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float fade = smoothstep(0.12, 0.85, d);
            float alpha = 1.0 - uStrength * (1.0 - fade);
            gl_FragColor = vec4(vec3(0.0), alpha);
          }
        `,
      })
    );
    floorFade.rotation.x = -Math.PI / 2;
    floorFade.position.y = FLOOR_Y + 0.005;
    scene.add(floorFade);

    const floorRing = new THREE.Mesh(
      new THREE.CircleGeometry(FLOOR_R + 0.35, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uGlow: { value: params.floorGlow } },
        vertexShader: flatVertexShader,
        fragmentShader: /* glsl */ `
          uniform float uGlow;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float ring = exp(-pow((d - 0.92) * 55.0, 2.0));
            float front = mix(0.15, 1.0, pow(1.0 - vUv.y, 1.8));
            float glow = ring * front * uGlow;
            gl_FragColor = vec4(vec3(0.9, 0.9, 0.9), glow);
          }
        `,
      })
    );
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = FLOOR_Y + 0.01;
    scene.add(floorRing);

    // Composer & Post processing
    const composer = new EffectComposer(
      renderer,
      new THREE.WebGLRenderTarget(container.clientWidth, container.clientHeight, {
        type: THREE.HalfFloatType,
        samples: isMobile ? 1 : 2,
      })
    );
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      params.bloomStrength,
      params.bloomRadius,
      params.bloomThreshold
    );
    composer.addPass(bloomPass);

    const FinalShader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uAberration: { value: params.aberration },
      },
      vertexShader: flatVertexShader,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uAberration;
        varying vec2 vUv;

        float random(vec2 st) {
          return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec2 dir = vUv - 0.5;
          float dist = length(dir);

          float amt = uAberration * dist * dist * 8.0;
          vec3 color = vec3(
            texture2D(tDiffuse, vUv - dir * amt).r,
            texture2D(tDiffuse, vUv).g,
            texture2D(tDiffuse, vUv + dir * amt).b
          );

          color *= smoothstep(0.95, 0.35, dist);
          color += (random(vUv) - 0.5) * 0.005;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    };
    const finalPass = new ShaderPass(FinalShader);
    composer.addPass(finalPass);
    composer.addPass(new OutputPass());

    // Front card detector
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    const getFrontCard = (): THREE.Mesh => {
      let best = cards[0];
      let bestZ = -Infinity;
      for (const card of cards) {
        const z = Math.cos(card.userData.angle + stateRef.current.theta);
        if (z > bestZ) {
          bestZ = z;
          best = card;
        }
      }
      if (stateRef.current.currentFront && stateRef.current.currentFront !== best) {
        const currentZ = Math.cos(
          stateRef.current.currentFront.userData.angle + stateRef.current.theta
        );
        if (bestZ - currentZ < 0.02) return stateRef.current.currentFront;
      }
      stateRef.current.currentFront = best;
      return best;
    };

    // Open & Close Card GSAP animation
    const openCard = (card: THREE.Mesh) => {
      stateRef.current.state = "opening";
      stateRef.current.openedCard = card;
      stateRef.current.velocity = 0;
      setExpandedTool(card.userData.tool);
      setShowSchemaModal(false); // Expanded card zoomed in 3D initially!
      if (onSelectTool) onSelectTool(card.userData.tool);

      const thetaTarget =
        -card.userData.angle +
        Math.round((stateRef.current.theta + card.userData.angle) / (Math.PI * 2)) *
          Math.PI *
          2;

      const visH = 2 * OPEN_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const visW = visH * camera.aspect;
      const targetSize = Math.min(visH * 0.8, visW * 0.8);
      const targetScale = targetSize / CARD_HEIGHT;

      const targetLocal = new THREE.Vector3(0, 0, camera.position.z - OPEN_DISTANCE).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -thetaTarget
      );

      let rotTarget = -thetaTarget;
      rotTarget += Math.round((card.rotation.y - rotTarget) / (Math.PI * 2)) * Math.PI * 2;

      const tl = gsap.timeline({ onComplete: () => (stateRef.current.state = "open") });
      tl.to(
        { t: stateRef.current.theta },
        {
          t: thetaTarget,
          duration: 0.9,
          ease: "power3.inOut",
          onUpdate() {
            stateRef.current.theta = (this as any).targets()[0].t;
          },
        },
        0
      );
      tl.to(
        card.position,
        {
          x: targetLocal.x,
          y: targetLocal.y,
          z: targetLocal.z,
          duration: 1.2,
          ease: "power3.inOut",
        },
        0.1
      );
      tl.to(
        card.rotation,
        {
          x: 0,
          y: rotTarget,
          z: 0,
          duration: 1.2,
          ease: "power3.inOut",
        },
        0.1
      );
      tl.to(
        card.scale,
        {
          x: targetScale,
          y: targetScale,
          z: 1,
          duration: 1.2,
          ease: "power3.inOut",
        },
        0.1
      );
      tl.to(
        (card.material as THREE.ShaderMaterial).uniforms.uOpen,
        {
          value: 1,
          duration: 0.9,
          ease: "power2.inOut",
        },
        0.5
      );
    };

    const closeCard = () => {
      const card = stateRef.current.openedCard;
      if (!card) return;
      stateRef.current.state = "closing";
      setShowSchemaModal(false);
      setExpandedTool(null);
      const { basePos, angle } = card.userData;

      let rotBase = angle;
      rotBase += Math.round((card.rotation.y - rotBase) / (Math.PI * 2)) * Math.PI * 2;

      const tl = gsap.timeline({
        onComplete: () => {
          stateRef.current.state = "closed";
          stateRef.current.openedCard = null;
        },
      });
      tl.to(
        (card.material as THREE.ShaderMaterial).uniforms.uOpen,
        {
          value: 0,
          duration: 0.7,
          ease: "power2.inOut",
        },
        0
      );
      tl.to(
        card.position,
        {
          x: basePos.x,
          y: basePos.y,
          z: basePos.z,
          duration: 1.1,
          ease: "power3.inOut",
        },
        0.1
      );
      tl.to(card.rotation, { x: 0, y: rotBase, z: 0, duration: 1.1, ease: "power3.inOut" }, 0.1);
      tl.to(card.scale, { x: 1, y: 1, z: 1, duration: 1.1, ease: "power3.inOut" }, 0.1);
    };

    let navTween: gsap.core.Tween | null = null;
    const goToCard = (index: number) => {
      if (stateRef.current.state !== "closed") return;
      stateRef.current.velocity = 0;
      lastInteract = clock.elapsedTime;
      navTween?.kill();
      const targetCardIndex = (index + CARD_COUNT) % CARD_COUNT;
      const angle = cards[targetCardIndex].userData.angle;
      const target =
        -angle + Math.round((stateRef.current.theta + angle) / (Math.PI * 2)) * (Math.PI * 2);
      navTween = gsap.to(
        { t: stateRef.current.theta },
        {
          t: target,
          duration: 0.9,
          ease: "power3.inOut",
          onUpdate() {
            stateRef.current.theta = (this as any).targets()[0].t;
          },
        }
      );
    };

    const stepCard = (dir: number) => {
      const currentFront = getFrontCard();
      const currentIdx = cards.indexOf(currentFront);
      goToCard((currentIdx + dir + CARD_COUNT) % CARD_COUNT);
    };

    stateRef.current.goToCard = goToCard;
    stateRef.current.stepCard = stepCard;
    stateRef.current.openCard = openCard;
    stateRef.current.closeCard = closeCard;

    // Event listeners
    const handlePointerDown = (e: PointerEvent) => {
      stateRef.current.downX = stateRef.current.lastX = e.clientX;
      stateRef.current.downY = e.clientY;
      if (stateRef.current.state === "closed") {
        stateRef.current.dragging = true;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      pointer.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      if (stateRef.current.dragging) {
        const delta = e.clientX - stateRef.current.lastX;
        stateRef.current.lastX = e.clientX;
        stateRef.current.theta += delta * 0.006;
        stateRef.current.velocity = delta * 0.36;
        lastInteract = clock.elapsedTime;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      stateRef.current.dragging = false;
      const moved = Math.hypot(
        e.clientX - stateRef.current.downX,
        e.clientY - stateRef.current.downY
      );
      if (moved > 6) return;

      if (stateRef.current.state === "open") {
        // Handled via UI controls when opened
      } else if (stateRef.current.state === "closed") {
        const front = getFrontCard();
        raycaster.setFromCamera(pointer, camera);
        if (raycaster.intersectObject(front, false).length > 0) {
          openCard(front);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (stateRef.current.state === "closed") {
        stateRef.current.velocity += e.deltaY * 0.0025;
        lastInteract = clock.elapsedTime;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSchemaModal) setShowSchemaModal(false);
        else if (stateRef.current.state === "open") closeCard();
      } else if (e.key === "ArrowRight") stepCard(1);
      else if (e.key === "ArrowLeft") stepCard(-1);
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    // Animation Loop with IntersectionObserver
    const clock = new THREE.Clock();
    let motionSmooth = 0;
    let lastInteract = 0;
    let idleSpin = 0;
    let lastFrontIdx = -1;
    let animId: number;
    let isGalleryVisible = true;
    let lastFrameTime = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isGalleryVisible = entry.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    const tick = (timestamp: number) => {
      animId = requestAnimationFrame(tick);

      if (!isGalleryVisible) return;

      if (timestamp - lastFrameTime < 14) return;
      lastFrameTime = timestamp;

      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      if (stateRef.current.state === "closed" && !stateRef.current.dragging) {
        stateRef.current.theta += stateRef.current.velocity * dt;
        stateRef.current.velocity *= Math.exp(-2.2 * dt);

        const idle = t - lastInteract > 2.5 ? 1 : 0;
        idleSpin += (idle - idleSpin) * Math.min(1, dt * 1.2);
        stateRef.current.theta += 0.08 * idleSpin * dt;
      }
      carousel.rotation.y = stateRef.current.theta;

      motionSmooth +=
        (Math.min(1, Math.abs(stateRef.current.velocity) * 0.7) - motionSmooth) *
        Math.min(1, dt * 4);

      const front = getFrontCard();
      const frontIdx = cards.indexOf(front);

      if (frontIdx !== lastFrontIdx && frontIdx !== -1) {
        lastFrontIdx = frontIdx;
        setActiveIndex(frontIdx);
      }

      for (const card of cards) {
        const u = card.userData;
        const mat = card.material as THREE.ShaderMaterial;
        mat.uniforms.uTime.value = t + u.phase * 10;
        mat.uniforms.uTheta.value = stateRef.current.theta;
        mat.uniforms.uMotion.value = motionSmooth;

        const targetFocus =
          card === front && stateRef.current.state === "closed" ? 1 : 0;
        u.focus += (targetFocus - u.focus) * Math.min(1, dt * 5);
        mat.uniforms.uFocus.value = u.focus;

        if (card === stateRef.current.openedCard) continue;

        card.position.y = 0;
        card.rotation.y = u.angle + pointerSmooth.x * 0.18 * u.focus;
        card.rotation.x = -pointerSmooth.y * 0.14 * u.focus;

        const s = 1 + 0.08 * u.focus;
        card.scale.setScalar(s);
      }

      if (stateRef.current.openedCard && stateRef.current.state === "open") {
        let rotY = -stateRef.current.theta + pointer.x * 0.12;
        rotY +=
          Math.round(
            (stateRef.current.openedCard.rotation.y - rotY) / (Math.PI * 2)
          ) *
          Math.PI *
          2;
        stateRef.current.openedCard.rotation.y +=
          (rotY - stateRef.current.openedCard.rotation.y) * Math.min(1, dt * 4);
        stateRef.current.openedCard.rotation.x +=
          (-pointer.y * 0.1 - stateRef.current.openedCard.rotation.x) *
          Math.min(1, dt * 4);
      }

      pointerSmooth.x += (pointer.x - pointerSmooth.x) * Math.min(1, dt * 2.2);
      pointerSmooth.y += (pointer.y - pointerSmooth.y) * Math.min(1, dt * 2.2);

      finalPass.uniforms.uTime.value = t;
      composer.render();
    };

    animId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fitCameraDistance();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
    };
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      textures.forEach((t) => t.dispose());
      cardGeometry.dispose();
      cards.forEach((c) => (c.material as THREE.Material).dispose());
      renderer.dispose();
    };
  }, [tools, onSelectTool, showSchemaModal]);

  const copySchemaToClipboard = (schemaObj: object) => {
    navigator.clipboard.writeText(JSON.stringify(schemaObj, null, 2));
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  return (
    <div ref={containerRef} className="dg-container">
      <canvas ref={canvasRef} className="dg-canvas" />

      {/* Radial Glow Overlay matching monochrome Apple minimal theme */}
      <div className="dg-glow" />

      {/* Integrated Click-to-Expand Hint */}
      {!expandedTool && (
        <div
          style={{
            position: "absolute",
            left: "2rem",
            top: "2rem",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--text-low)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6875rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            pointerEvents: "none",
            opacity: 0.8,
          }}
        >
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              backgroundColor: "var(--text-low)",
              display: "inline-block",
            }}
          />
          Click card to expand ↗
        </div>
      )}

      {/* Counter & Panel Right */}
      {!expandedTool && (
        <div className="dg-panel-right">
          <div>
            <span className="dg-counter-idx">
              / {String(activeIndex + 1).padStart(2, "0")}
            </span>
            <span className="dg-counter-title">
              {tools[activeIndex]?.name || "Tool"}
            </span>
          </div>

          {/* Arrow Navigation */}
          <div style={{ display: "flex", gap: "0.5rem", pointerEvents: "auto" }}>
            <button
              className="dg-circle-btn"
              onClick={() => stateRef.current.stepCard(-1)}
              title="Previous tool"
            >
              ←
            </button>
            <button
              className="dg-circle-btn"
              onClick={() => stateRef.current.stepCard(1)}
              title="Next tool"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Bottom Thumbnail Strip */}
      {!expandedTool && (
        <div className="dg-thumb-strip">
          <button
            className="dg-circle-btn"
            style={{ width: "32px", height: "32px", fontSize: "0.8rem" }}
            onClick={() => stateRef.current.stepCard(-1)}
          >
            ←
          </button>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            {tools.map((t, idx) => (
              <button
                key={t.num}
                onClick={() => stateRef.current.goToCard(idx)}
                className={`dg-thumb-pill${idx === activeIndex ? " active" : ""}`}
              >
                {t.num} {t.name.split("_")[0]}
              </button>
            ))}
          </div>

          <button
            className="dg-circle-btn"
            style={{ width: "32px", height: "32px", fontSize: "0.8rem" }}
            onClick={() => stateRef.current.stepCard(1)}
          >
            →
          </button>
        </div>
      )}

      {/* 3D Expanded Card Overlay Controls */}
      {expandedTool && !showSchemaModal && (
        <div
          style={{
            position: "absolute",
            bottom: "2.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: "0.875rem",
            pointerEvents: "auto",
            animation: "fadeUp 240ms ease both",
          }}
        >
          {expandedTool.schema && (
            <button
              onClick={() => setShowSchemaModal(true)}
              className="active-press"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.75rem 1.5rem",
                borderRadius: "100px",
                border: "1px solid var(--border-strong)",
                backgroundColor: "rgba(18, 18, 18, 0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                color: "#ffffff",
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.7)",
              }}
            >
              <span>⚙</span> View JSON Schema & Parameters
            </button>
          )}

          <button
            onClick={() => stateRef.current.closeCard()}
            className="active-press"
            style={{
              padding: "0.75rem 1.25rem",
              borderRadius: "100px",
              border: "1px solid var(--border-strong)",
              backgroundColor: "rgba(38, 38, 38, 0.85)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              color: "#ffffff",
              fontFamily: "var(--font-mono)",
              fontSize: "0.78rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.7)",
            }}
          >
            ✕ Close Card
          </button>
        </div>
      )}

      {/* On-Top JSON Schema & Parameter Inspector Modal */}
      {expandedTool && expandedTool.schema && showSchemaModal && (
        <div
          style={{
            position: "absolute",
            inset: "1.75rem",
            zIndex: 35,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#121212",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.35)",
            borderRadius: "16px",
            padding: "1.75rem 2rem",
            color: "#ffffff",
            overflow: "hidden",
            boxShadow: "0 30px 60px rgba(0, 0, 0, 0.95)",
            pointerEvents: "auto",
            animation: "fadeUp 260ms cubic-bezier(0.23, 1, 0.32, 1) both",
          }}
        >
          {/* Header matching card aesthetic */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.25rem",
              paddingBottom: "1rem",
              borderBottom: "1px solid var(--border-muted)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span
                style={{
                  padding: "0.25rem 0.75rem",
                  borderRadius: "100px",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#ffffff",
                  letterSpacing: "0.08em",
                }}
              >
                {expandedTool.tag}
              </span>
              <h3
                className="display-font"
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: "#ffffff",
                }}
              >
                {expandedTool.name}
              </h3>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {/* Tab Selector */}
              <div
                style={{
                  display: "flex",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                  border: "1px solid var(--border-muted)",
                  padding: "3px",
                }}
              >
                <button
                  onClick={() => setActiveTab("params")}
                  style={{
                    padding: "0.35rem 0.85rem",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor:
                      activeTab === "params" ? "rgba(255, 255, 255, 0.15)" : "transparent",
                    color: activeTab === "params" ? "#ffffff" : "var(--text-medium)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Parameters
                </button>
                <button
                  onClick={() => setActiveTab("schema")}
                  style={{
                    padding: "0.35rem 0.85rem",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor:
                      activeTab === "schema" ? "rgba(255, 255, 255, 0.15)" : "transparent",
                    color: activeTab === "schema" ? "#ffffff" : "var(--text-medium)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Raw JSON Schema
                </button>
              </div>

              {/* Close Modal Button */}
              <button
                onClick={() => setShowSchemaModal(false)}
                className="active-press"
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  color: "#ffffff",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ✕ Close Inspector
              </button>
            </div>
          </div>

          {/* Description */}
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--text-medium)",
              marginBottom: "1.25rem",
              lineHeight: 1.5,
              fontFamily: "var(--font-body)",
            }}
          >
            {expandedTool.desc}
          </p>

          {/* Content Body */}
          <div style={{ flex: 1, overflowY: "auto", paddingRight: "0.5rem" }}>
            {activeTab === "params" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {Object.entries(expandedTool.schema.properties || {}).map(
                  ([key, prop]: [string, any]) => {
                    const isRequired = (
                      expandedTool.schema?.required || []
                    ).includes(key);
                    return (
                      <div
                        key={key}
                        style={{
                          padding: "1rem 1.25rem",
                          borderRadius: "10px",
                          backgroundColor: "#1a1a1a",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.375rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.625rem",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.875rem",
                                fontWeight: 700,
                                color: "#ffffff",
                              }}
                            >
                              {key}
                            </span>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.7rem",
                                padding: "0.15rem 0.5rem",
                                borderRadius: "4px",
                                backgroundColor: "rgba(255, 255, 255, 0.08)",
                                color: "var(--text-medium)",
                              }}
                            >
                              {prop.type || "string"}
                            </span>
                          </div>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.6875rem",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "4px",
                              backgroundColor: isRequired
                                ? "rgba(255, 255, 255, 0.15)"
                                : "transparent",
                              color: isRequired ? "#ffffff" : "var(--text-low)",
                              border: isRequired
                                ? "1px solid rgba(255, 255, 255, 0.3)"
                                : "none",
                              fontWeight: isRequired ? 600 : 400,
                            }}
                          >
                            {isRequired ? "Required" : "Optional"}
                          </span>
                        </div>
                        {prop.description && (
                          <p
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--text-medium)",
                              lineHeight: 1.5,
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            {prop.description}
                          </p>
                        )}
                        {prop.default !== undefined && (
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.75rem",
                              color: "var(--text-low)",
                              marginTop: "0.25rem",
                            }}
                          >
                            Default: <code>{JSON.stringify(prop.default)}</code>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => copySchemaToClipboard(expandedTool.schema!)}
                  className="active-press"
                  style={{
                    position: "absolute",
                    top: "0.75rem",
                    right: "0.75rem",
                    padding: "0.4rem 0.85rem",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    backgroundColor: copiedSchema
                      ? "#ffffff"
                      : "rgba(255, 255, 255, 0.1)",
                    color: copiedSchema ? "#000000" : "#ffffff",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    zIndex: 10,
                  }}
                >
                  {copiedSchema ? "Copied" : "Copy JSON Schema"}
                </button>
                <pre
                  style={{
                    padding: "1.25rem",
                    borderRadius: "10px",
                    backgroundColor: "#050505",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.78rem",
                    color: "#e4e4e7",
                    lineHeight: 1.6,
                    overflowX: "auto",
                  }}
                >
                  <code>{JSON.stringify(expandedTool.schema, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
