import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, RoundedBox, Torus } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

const AnimatedAvatar = () => {
  const groupRef = useRef<THREE.Group>(null);
  const torusRef = useRef<THREE.Mesh>(null);
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
      groupRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.2) * 0.1;
    }
    if (torusRef.current) {
      torusRef.current.rotation.x += 0.01;
      torusRef.current.rotation.y += 0.01;
    }
    if (sphereRef.current) {
      sphereRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main sphere with distortion */}
      <mesh ref={sphereRef}>
        <Sphere args={[1.2, 64, 64]}>
          <MeshDistortMaterial
            color="hsl(var(--ai-accent))"
            attach="material"
            distort={0.4}
            speed={2}
            roughness={0.2}
            metalness={0.8}
          />
        </Sphere>
      </mesh>

      {/* Orbiting torus */}
      <mesh ref={torusRef} position={[0, 0, 0]}>
        <Torus args={[1.8, 0.15, 16, 100]}>
          <meshStandardMaterial
            color="hsl(var(--primary))"
            emissive="hsl(var(--primary))"
            emissiveIntensity={0.5}
            metalness={0.9}
            roughness={0.1}
          />
        </Torus>
      </mesh>

      {/* Floating particles */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 2.5;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle * 2) * 0.5,
              Math.sin(angle) * radius,
            ]}
          >
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial
              color="hsl(var(--ai-glow))"
              emissive="hsl(var(--ai-glow))"
              emissiveIntensity={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
};

export const AvatarPlaceholder = () => {
  return (
    <div className="w-full h-full bg-gradient-to-br from-background via-card to-primary/10">
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={1} color="hsl(var(--primary))" />
        <pointLight position={[-5, -5, -5]} intensity={0.5} color="hsl(var(--ai-accent))" />
        <spotLight
          position={[0, 10, 0]}
          angle={0.3}
          penumbra={1}
          intensity={0.5}
          color="hsl(var(--ai-glow))"
        />
        <AnimatedAvatar />
        <OrbitControls 
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
};
