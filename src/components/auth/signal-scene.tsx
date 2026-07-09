"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

const PARTICLE_COUNT = 2600;
const SPHERE_RADIUS = 2.2;

/** Evenly distributed points on a sphere (Fibonacci lattice). */
function useSpherePositions(): Float32Array {
  return useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const increment = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const y = 1 - (2 * i) / (PARTICLE_COUNT - 1);
      const radius = Math.sqrt(1 - y * y);
      const phi = i * increment;
      positions[i * 3] = Math.cos(phi) * radius * SPHERE_RADIUS;
      positions[i * 3 + 1] = y * SPHERE_RADIUS;
      positions[i * 3 + 2] = Math.sin(phi) * radius * SPHERE_RADIUS;
    }
    return positions;
  }, []);
}

function ParticleShell() {
  const ref = useRef<THREE.Points>(null);
  const positions = useSpherePositions();

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.07;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.12) * 0.18;
    const breath = 1 + Math.sin(state.clock.elapsedTime * 0.45) * 0.025;
    ref.current.scale.setScalar(breath);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.022}
        color="#a5b4fc"
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function WireCore() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y -= delta * 0.11;
    ref.current.rotation.z += delta * 0.04;
  });

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.15, 1]} />
      <meshBasicMaterial color="#6366f1" wireframe transparent opacity={0.32} />
    </mesh>
  );
}

function OrbitRing({ radius, tilt, speed }: { radius: number; tilt: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z += delta * speed;
  });

  return (
    <mesh ref={ref} rotation={[tilt, 0.4, 0]}>
      <torusGeometry args={[radius, 0.004, 8, 160]} />
      <meshBasicMaterial color="#818cf8" transparent opacity={0.25} />
    </mesh>
  );
}

/**
 * The abstract "signal sphere" behind the auth screens: a breathing particle
 * shell around a slow wireframe core, with two orbit rings. Under reduced
 * motion it renders a single static frame.
 */
export function SignalScene() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <Canvas
      camera={{ position: [0, 0, 6.2], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      frameloop={reducedMotion ? "demand" : "always"}
      className="pointer-events-none"
    >
      <ParticleShell />
      <WireCore />
      <OrbitRing radius={3.05} tilt={1.15} speed={0.05} />
      <OrbitRing radius={3.45} tilt={2.1} speed={-0.035} />
    </Canvas>
  );
}
