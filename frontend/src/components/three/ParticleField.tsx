import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ParticleFieldProps {
  particleCount?: number;
  color?: string;
  speed?: number;
  mouseInteraction?: boolean;
}

// Check if WebGL is available
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/**
 * CSS-only Fallback when WebGL is not available
 */
function CSSParticleFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Gradient background */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(34, 211, 238, 0.15) 0%, transparent 70%)',
        }}
      />
      
      {/* Animated particles using CSS */}
      <div className="absolute inset-0">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-cyan-400/30"
            style={{
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float-particle ${8 + Math.random() * 12}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
              opacity: Math.random() * 0.5 + 0.2,
            }}
          />
        ))}
      </div>
      
      {/* Ambient glow orbs */}
      <div 
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div 
        className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animationDelay: '1s',
        }}
      />
      
      <style>{`
        @keyframes float-particle {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: 0.3;
          }
          25% {
            transform: translate(20px, -30px) scale(1.2);
            opacity: 0.6;
          }
          50% {
            transform: translate(-15px, -50px) scale(0.8);
            opacity: 0.4;
          }
          75% {
            transform: translate(25px, -20px) scale(1.1);
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Three.js Particle Field Background
 * Creates an immersive 3D particle system with ambient glow
 * Falls back to CSS animation when WebGL is not available
 */
export default function ParticleField({
  particleCount = 1500,
  color = '#22D3EE',
  speed = 0.3,
  mouseInteraction = true,
}: ParticleFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetMouseRef = useRef({ x: 0, y: 0 });
  const [webGLSupported, setWebGLSupported] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Check WebGL support
    if (!isWebGLAvailable()) {
      setWebGLSupported(false);
      return;
    }

    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Define cleanup variables at the top
    let renderer: THREE.WebGLRenderer;
    let animationId: number;
    let geometry: THREE.BufferGeometry;
    let material: THREE.ShaderMaterial;
    let ambientGeometry: THREE.BufferGeometry;
    let ambientMaterial: THREE.ShaderMaterial;
    let onMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
    let onResizeHandler: (() => void) | null = null;

    try {
      // Scene setup
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x09090B, 0.0008);

      // Camera
      const camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000);
      camera.position.z = 1000;

      // Renderer with error handling
      renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      // Particles
      geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);
      const opacities = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // Spread particles in a sphere
        const radius = 800 + Math.random() * 400;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi) - 500;
        
        // Random velocities for organic movement
        velocities[i3] = (Math.random() - 0.5) * 0.5;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.5;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.5;
        
        sizes[i] = Math.random() * 3 + 1;
        opacities[i] = Math.random() * 0.5 + 0.2;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material for glow effect
    material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: `
        attribute float size;
        varying float vOpacity;
        uniform float uTime;
        uniform vec2 uMouse;
        
        void main() {
          vec3 pos = position;
          
          // Gentle wave motion
          pos.x += sin(uTime * 0.3 + position.y * 0.01) * 10.0;
          pos.y += cos(uTime * 0.2 + position.x * 0.01) * 10.0;
          pos.z += sin(uTime * 0.4 + position.x * 0.01) * 5.0;
          
          // Mouse influence
          float dist = distance(pos.xy, uMouse * 500.0);
          float influence = smoothstep(300.0, 0.0, dist);
          pos.z += influence * 50.0;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          
          // Size attenuation
          gl_PointSize = size * (600.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          
          // Pass opacity based on depth
          vOpacity = smoothstep(-1500.0, -200.0, mvPosition.z) * 0.8;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vOpacity;
        
        void main() {
          // Circular particle with soft edge
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          if (dist > 0.5) discard;
          
          // Soft glow falloff
          float alpha = smoothstep(0.5, 0.0, dist) * vOpacity;
          
          // Add inner glow
          float glow = exp(-dist * 4.0) * 0.5;
          
          gl_FragColor = vec4(uColor, alpha + glow * vOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Add subtle ambient particles (smaller, dimmer)
    ambientGeometry = new THREE.BufferGeometry();
    const ambientPositions = new Float32Array(500 * 3);
    const ambientSizes = new Float32Array(500);

    for (let i = 0; i < 500; i++) {
      const i3 = i * 3;
      ambientPositions[i3] = (Math.random() - 0.5) * 2000;
      ambientPositions[i3 + 1] = (Math.random() - 0.5) * 2000;
      ambientPositions[i3 + 2] = (Math.random() - 0.5) * 1500;
      ambientSizes[i] = Math.random() * 1.5 + 0.5;
    }

    ambientGeometry.setAttribute('position', new THREE.BufferAttribute(ambientPositions, 3));
    ambientGeometry.setAttribute('size', new THREE.BufferAttribute(ambientSizes, 1));

    ambientMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#8B5CF6') },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: material.vertexShader,
      fragmentShader: material.fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const ambientParticles = new THREE.Points(ambientGeometry, ambientMaterial);
    scene.add(ambientParticles);

    // Mouse tracking
    onMouseMoveHandler = (event: MouseEvent) => {
      targetMouseRef.current.x = (event.clientX / width) * 2 - 1;
      targetMouseRef.current.y = -(event.clientY / height) * 2 + 1;
    };

    if (mouseInteraction) {
      window.addEventListener('mousemove', onMouseMoveHandler);
    }

    // Animation loop
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      const elapsedTime = clock.getElapsedTime();
      
      // Smooth mouse following
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.05;
      
      // Update uniforms
      material.uniforms.uTime.value = elapsedTime * speed;
      material.uniforms.uMouse.value.set(mouseRef.current.x, mouseRef.current.y);
      ambientMaterial.uniforms.uTime.value = elapsedTime * speed * 0.5;
      
      // Gentle rotation
      particles.rotation.y = elapsedTime * 0.02;
      particles.rotation.x = Math.sin(elapsedTime * 0.1) * 0.1;
      ambientParticles.rotation.y = -elapsedTime * 0.01;
      
      // Camera subtle movement
      camera.position.x = Math.sin(elapsedTime * 0.1) * 30;
      camera.position.y = Math.cos(elapsedTime * 0.1) * 20;
      camera.lookAt(scene.position);
      
      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    onResizeHandler = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', onResizeHandler);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      if (onResizeHandler) {
        window.removeEventListener('resize', onResizeHandler);
      }
      if (mouseInteraction && onMouseMoveHandler) {
        window.removeEventListener('mousemove', onMouseMoveHandler);
      }
      
      geometry?.dispose();
      material?.dispose();
      ambientGeometry?.dispose();
      ambientMaterial?.dispose();
      renderer?.dispose();
      
      if (renderer && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    } catch (error) {
      console.warn('WebGL initialization failed, falling back to CSS animation:', error);
      setHasError(true);
    }
  }, [particleCount, color, speed, mouseInteraction]);

  // Show CSS fallback if WebGL is not supported or failed
  if (!webGLSupported || hasError) {
    return (
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: '#09090B' }}
      >
        <CSSParticleFallback />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ background: '#09090B' }}
    />
  );
}
