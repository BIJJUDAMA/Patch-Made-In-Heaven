"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  in vec3 position;
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  
  uniform vec3 iResolution;
  uniform float iTime;
  
  uniform int u_renderPasses;
  uniform float u_sceneTimeScale;
  uniform float u_grainIntensity;
  uniform float u_globalLuminance;
  uniform float u_stepPrecision;
  uniform float u_rayIterations;
  uniform float u_surfaceSolidity;
  
  uniform float u_camPosX;
  uniform float u_camPosY;
  uniform float u_camPitch;
  uniform float u_camFov;
  uniform float u_camShiftX;
  uniform float u_camShiftY;

  out vec4 outColor;

  mat2 calcRotation(float theta) {
    float sine = sin(theta);
    float cosine = cos(theta);
    return mat2(cosine, -sine, sine, cosine);
  }

  vec3 applyCinematicGrade(vec3 rawColor) {
    mat3 colorSpaceA = mat3(
      0.59719, 0.07600, 0.02840, 
      0.35458, 0.90834, 0.13383, 
      0.04823, 0.01566, 0.83777
    );
    mat3 colorSpaceB = mat3(
      1.60475, -0.10208, -0.00327, 
      -0.53108, 1.10813, -0.07276, 
      -0.07367, -0.00605, 1.07602
    );
    
    vec3 graded = colorSpaceA * rawColor;
    vec3 numerator = graded * (graded + 0.0945786) - 0.000090537;
    vec3 denominator = graded * (0.783729 * graded + 0.4329510) + 0.238081;
    
    return colorSpaceB * (numerator / denominator);
  }

  float computeStructuralDensity(vec3 pos) {
    const float phaseShift = 0.228033988;
    const mat3 structuralBasis = mat3(
      0.388535087,  0.054921382, -0.743402928,
      0.441955127,  4.336973341,  0.258518454,
      0.272087367,  0.174042493, -0.021246185
    );
    return dot(cos(structuralBasis * pos), sin(phaseShift * pos * structuralBasis));
  }

  float getFilmGrain(vec3 seed3D) {
    seed3D = fract(seed3D * 0.1031);
    seed3D += dot(seed3D, seed3D.zyx + 31.32);
    return fract((seed3D.x + seed3D.y) * seed3D.z);
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec3 finalImage = vec3(0.0);
    float globalTime = iTime * u_sceneTimeScale;
    
    for(int passX = 0; passX < 4; passX++) {
      if (passX >= u_renderPasses) break;
      
      for(int passY = 0; passY < 4; passY++) {
        if (passY >= u_renderPasses) break;
        
        vec2 pixelOffset = (vec2(float(passX), float(passY)) + 0.5) / float(u_renderPasses) - 0.5;
        vec2 uv = fragCoord + pixelOffset; 
        
        vec3 rayOrigin = vec3(u_camPosX, u_camPosY, globalTime); 
        vec3 lightAccumulator = vec3(0.0);
        
        vec3 viewDir = normalize(vec3(u_camFov * uv - iResolution.xy * vec2(u_camShiftX, u_camShiftY), iResolution.y));
        viewDir.yz = calcRotation(u_camPitch) * viewDir.yz; 
        
        float stepDistance;
        
        for(float iter = 0.0; iter < 100.0; iter += 1.0) {
          if (iter >= u_rayIterations) break;

          vec3 samplePos = rayOrigin;
          
          float detailNoise = computeStructuralDensity(samplePos * 20.0) / 20.0;
          float baseNoise = computeStructuralDensity(samplePos);
          
          stepDistance = 0.005 + abs(detailNoise - baseNoise) * 0.7;
          
          float heightMod = sin(samplePos.z * 2.0 + abs(samplePos.x) * 0.5) * 0.5;
          stepDistance += abs(rayOrigin.y + heightMod) * 0.4;
          
          float safeStep = stepDistance * u_stepPrecision;
          rayOrigin += viewDir * safeStep;
          
          float colorPhase = (iter * u_stepPrecision) - 0.4;
          float wavePhase = colorPhase + length(rayOrigin.xz * 0.1) + 2.0;
          vec3 spectralGlow = vec3(1.2 + 0.8 * sin(wavePhase));
          
          float rawDensity = 1.0 / stepDistance;
          float sharpDensity = pow(rawDensity, u_surfaceSolidity) * 0.15; 
          
          lightAccumulator += (spectralGlow * sharpDensity) * u_stepPrecision;
        }
        
        lightAccumulator *= u_globalLuminance;
        finalImage += applyCinematicGrade(lightAccumulator * lightAccumulator / 1000.0);
      }
    }
    
    finalImage *= (4.0 / float(u_renderPasses * u_renderPasses));
    finalImage = (finalImage - 0.5) * 0.5 + 0.5;
    finalImage *= 0.35;
    
    float grainValue = getFilmGrain(vec3(fragCoord, iTime));
    finalImage += (grainValue - 0.5) * u_grainIntensity;
    
    fragColor = vec4(finalImage, 1.0);
  }

  void main() {
    mainImage(outColor, gl_FragCoord.xy);
  }
`;

export default function HeroShader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const params = {
      passes: 1,
      speed: 0.6,
      grain: 0.035,
      luminance: 4.8,
      precision: 0.5,
      iterations: 24.0,
      solidity: 1.1,
      camX: 2.8,
      camY: -1.0,
      camPitch: -0.38,
      camFov: 2.5,
      camShiftX: 1.0,
      camShiftY: 1.0,
    };

    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        iResolution: { value: new THREE.Vector3() },
        iTime: { value: 0.0 },
        u_renderPasses: { value: params.passes },
        u_sceneTimeScale: { value: params.speed },
        u_grainIntensity: { value: params.grain },
        u_globalLuminance: { value: params.luminance },
        u_stepPrecision: { value: params.precision },
        u_rayIterations: { value: params.iterations },
        u_surfaceSolidity: { value: params.solidity },
        u_camPosX: { value: params.camX },
        u_camPosY: { value: params.camY },
        u_camPitch: { value: params.camPitch },
        u_camFov: { value: params.camFov },
        u_camShiftX: { value: params.camShiftX },
        u_camShiftY: { value: params.camShiftY },
      },
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const resize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      renderer.setSize(width, height);

      const dpr = renderer.getPixelRatio();
      material.uniforms.iResolution.value.set(width * dpr, height * dpr, 1.0);
    };

    window.addEventListener("resize", resize);
    resize();

    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      material.uniforms.iTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          opacity: 0.85,
        }}
      />
      {/* Dark gradient overlay for optimal text contrast */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, rgba(14, 14, 14, 0.4) 0%, rgba(14, 14, 14, 0.88) 100%)",
        }}
      />
    </div>
  );
}
