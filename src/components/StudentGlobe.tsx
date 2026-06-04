import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, Line, OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import * as THREE from "three";
import { cn } from "../lib/utils";
import {
  BISHKEK,
  studentLatLon,
  type AppStudent,
} from "../data/appStudents";

// ─── Palette (purple premium) ───────────────────────────────────────────────────

const GLOBE_R = 1;
const C_LINE = "#9F7AEA";       // Brand purple
const C_LINE_SOFT = "#C4B5FD";  // Soft violet
const C_HALO = "#EDE9FE";       // Light halo

const COASTLINE_URL =
  "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/physical/ne_110m_coastline.json";

const CAM: [number, number, number] = [0, 0.35, 3.8];
const FRONT_DIR = new THREE.Vector3(...CAM).normalize();

function latLonToVec3(lat: number, lon: number, r = GLOBE_R): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function slerpPoint(a: THREE.Vector3, b: THREE.Vector3, t: number, r: number): THREE.Vector3 {
  const an = a.clone().normalize();
  const bn = b.clone().normalize();
  const dot = Math.max(-1, Math.min(1, an.dot(bn)));
  const theta = Math.acos(dot);
  if (theta < 1e-4) return an.multiplyScalar(r);
  const sinT = Math.sin(theta);
  const w1 = Math.sin((1 - t) * theta) / sinT;
  const w2 = Math.sin(t * theta) / sinT;
  return an.multiplyScalar(w1).add(bn.multiplyScalar(w2)).multiplyScalar(r);
}

type LonLat = [number, number];

function Continents() {
  const [positions, setPositions] = useState<Float32Array | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(COASTLINE_URL, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();

        const segs: number[] = [];
        const R = GLOBE_R + 0.004;
        const STEPS = 6;

        const addLine = (coords: LonLat[]) => {
          let prev: THREE.Vector3 | null = null;
          for (const [lon, lat] of coords) {
            const cur = latLonToVec3(lat, lon, R);
            if (prev) {
              let last = prev;
              for (let s = 1; s <= STEPS; s++) {
                const p = slerpPoint(prev, cur, s / STEPS, R);
                segs.push(last.x, last.y, last.z, p.x, p.y, p.z);
                last = p;
              }
            }
            prev = cur;
          }
        };

        type Geometry =
          | { type: "LineString"; coordinates: LonLat[] }
          | { type: "MultiLineString"; coordinates: LonLat[][] }
          | { type: "Polygon"; coordinates: LonLat[][] }
          | { type: "MultiPolygon"; coordinates: LonLat[][][] };

        for (const feature of data.features as { geometry: Geometry | null }[]) {
          const g = feature.geometry;
          if (!g) continue;
          if (g.type === "LineString") addLine(g.coordinates);
          else if (g.type === "MultiLineString") g.coordinates.forEach(addLine);
          else if (g.type === "Polygon") g.coordinates.forEach(addLine);
          else if (g.type === "MultiPolygon")
            g.coordinates.forEach((poly) => poly.forEach(addLine));
        }

        setPositions(new Float32Array(segs));
      } catch {
        // Fallback handled by graticule
      }
    })();
    return () => controller.abort();
  }, []);

  const geometry = useMemo(() => {
    if (!positions) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry} renderOrder={3}>
      <lineBasicMaterial color={C_LINE} transparent opacity={0.85} depthWrite={false} />
    </lineSegments>
  );
}

function ContinentsMesh() {
  const specularMap = useLoader(THREE.TextureLoader, "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg");
  
  const uniforms = useMemo(
    () => ({
      map: { value: specularMap },
      colorLand: { value: new THREE.Color("#C4B5FD") },
    }),
    [specularMap]
  );

  return (
    <mesh renderOrder={1}>
      <sphereGeometry args={[GLOBE_R + 0.002, 64, 64]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform sampler2D map;
          uniform vec3 colorLand;
          varying vec2 vUv;
          void main() {
            float isWater = texture2D(map, vUv).r;
            // Use smoothstep for soft, anti-aliased continent edges
            float landFactor = smoothstep(0.4, 0.6, 1.0 - isWater);
            float alpha = landFactor * 0.4;
            if (alpha < 0.02) discard;
            gl_FragColor = vec4(colorLand, alpha);
          }
        `}
      />
    </mesh>
  );
}

function GlobeMesh() {
  return (
    <mesh renderOrder={0}>
      <sphereGeometry args={[GLOBE_R, 64, 64]} />
      <meshStandardMaterial color="#FFFFFF" roughness={0.85} metalness={0} transparent opacity={0.42} />
    </mesh>
  );
}

function Graticule() {
  return (
    <mesh renderOrder={1}>
      <sphereGeometry args={[GLOBE_R + 0.001, 36, 24]} />
      <meshBasicMaterial color={C_LINE_SOFT} wireframe transparent opacity={0.12} depthWrite={false} />
    </mesh>
  );
}

function Atmosphere() {
  return (
    <>
      {/* Outer large soft glow */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[GLOBE_R * 1.35, 48, 48]} />
        <meshBasicMaterial color={C_LINE_SOFT} transparent opacity={0.15} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* Mid glow */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[GLOBE_R * 1.15, 48, 48]} />
        <meshBasicMaterial color={C_LINE_SOFT} transparent opacity={0.25} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* Inner strong glow rim */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[GLOBE_R * 1.05, 48, 48]} />
        <meshBasicMaterial color={C_LINE} transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* Front slight tint */}
      <mesh renderOrder={2}>
        <sphereGeometry args={[GLOBE_R * 1.002, 48, 48]} />
        <meshBasicMaterial color={C_LINE_SOFT} transparent opacity={0.08} side={THREE.FrontSide} depthWrite={false} />
      </mesh>
    </>
  );
}

const RING_DEFS = [
  { r: 1.42, tiltX: Math.PI / 2 + 0.42, tiltZ: 0.32, color: C_LINE_SOFT, opacity: 0.22 },
  { r: 1.68, tiltX: Math.PI / 2 + 0.18, tiltZ: -0.2, color: C_LINE, opacity: 0.18 },
  { r: 1.95, tiltX: Math.PI / 2 - 0.3, tiltZ: 0.5, color: C_LINE_SOFT, opacity: 0.12 },
];

function OrbitalRings() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y -= delta * 0.05;
  });
  return (
    <group ref={ref} rotation={[0.4, 0, 0.25]}>
      {RING_DEFS.map((ring) => (
        <mesh key={ring.r} rotation={[ring.tiltX, 0, ring.tiltZ]}>
          <torusGeometry args={[ring.r, 0.0045, 8, 180]} />
          <meshBasicMaterial color={ring.color} transparent opacity={ring.opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

type MarkerKind = "source" | "active" | "default";

function Marker({
  lat,
  lon,
  kind,
  onClick,
}: {
  lat: number;
  lon: number;
  kind: MarkerKind;
  onClick?: () => void;
}) {
  const pos = useMemo(() => latLonToVec3(lat, lon, GLOBE_R + 0.012), [lat, lon]);
  const size = kind === "source" ? 0.026 : kind === "active" ? 0.022 : 0.015;
  const color = kind === "source" ? "#0F172A" : kind === "active" ? C_LINE : C_LINE_SOFT;

  return (
    <group position={pos}>
      <mesh
        onClick={
          onClick
            ? (e) => {
                e.stopPropagation();
                onClick();
              }
            : undefined
        }
        onPointerOver={
          onClick
            ? () => {
                document.body.style.cursor = "pointer";
              }
            : undefined
        }
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {kind !== "default" && (
        <mesh>
          <sphereGeometry args={[size * 2.4, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function GlobeArc({
  source,
  target,
  replayKey,
}: {
  source: { lat: number; lon: number };
  target: { lat: number; lon: number };
  replayKey: number;
}) {
  const progressRef = useRef(0);

  useEffect(() => {
    progressRef.current = 0;
  }, [replayKey]);

  const [pts, setPts] = useState<[number, number, number][]>(() => {
    const s = latLonToVec3(source.lat, source.lon, GLOBE_R + 0.012);
    return [
      [s.x, s.y, s.z],
      [s.x, s.y, s.z],
    ];
  });

  const allPts = useMemo(() => {
    const start = latLonToVec3(source.lat, source.lon, GLOBE_R + 0.012);
    const end = latLonToVec3(target.lat, target.lon, GLOBE_R + 0.012);
    const mid = start.clone().add(end).normalize().multiplyScalar(GLOBE_R + 0.55);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return curve.getPoints(100).map((p) => [p.x, p.y, p.z] as [number, number, number]);
  }, [source, target]);

  useFrame((_, delta) => {
    if (progressRef.current >= 1) return;
    progressRef.current = Math.min(1, progressRef.current + delta * 0.8);
    const n = Math.max(2, Math.floor(allPts.length * progressRef.current));
    setPts(allPts.slice(0, n));
  });

  return (
    <>
      <Line points={pts} color={C_LINE} lineWidth={2.5} transparent opacity={0.95} />
      <Line points={pts} color={C_LINE_SOFT} lineWidth={7} transparent opacity={0.22} />
    </>
  );
}

function GlobeGroup({
  students,
  activeId,
  focusKey,
  userInteractingRef,
  onSelect,
}: {
  students: AppStudent[];
  activeId: string | null;
  focusKey: number;
  userInteractingRef: RefObject<boolean>;
  onSelect: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetQuat = useRef(new THREE.Quaternion());

  const active = useMemo(
    () => students.find((s) => s.id === activeId) ?? null,
    [students, activeId],
  );

  useFrame((_, delta) => {
    if (!active || userInteractingRef.current) return;
    const g = groupRef.current;
    if (!g) return;

    const { lat, lon } = studentLatLon(active);
    const dir = latLonToVec3(lat, lon, 1).normalize();
    targetQuat.current.setFromUnitVectors(dir, FRONT_DIR);
    const t = 1 - Math.pow(0.0016, delta);
    g.quaternion.slerp(targetQuat.current, t);
  });

  return (
    <group ref={groupRef}>
      <GlobeMesh />
      <ContinentsMesh />
      <Graticule />
      <Continents />

      <Marker lat={BISHKEK.lat} lon={BISHKEK.lon} kind="source" />

      {students.map((s) => {
        const { lat, lon } = studentLatLon(s);
        const isActive = s.id === activeId;
        return (
          <Marker
            key={s.id}
            lat={lat}
            lon={lon}
            kind={isActive ? "active" : "default"}
            onClick={() => onSelect(s.id)}
          />
        );
      })}

      {active && (
        <GlobeArc
          key={`${active.id}-${focusKey}`}
          replayKey={focusKey}
          source={BISHKEK}
          target={studentLatLon(active)}
        />
      )}
    </group>
  );
}

function GlobeScene({
  students,
  activeId,
  focusKey,
  onSelect,
}: {
  students: AppStudent[];
  activeId: string | null;
  focusKey: number;
  onSelect: (id: string) => void;
}) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const userInteractingRef = useRef(false);

  useEffect(() => {
    userInteractingRef.current = false;
    controlsRef.current?.reset();
  }, [focusKey, activeId]);

  return (
    <>
      <ambientLight intensity={1.05} />
      <directionalLight position={[3, 4, 5]} intensity={0.7} color="#ffffff" />
      <directionalLight position={[-4, -2, -3]} intensity={0.25} color={C_HALO} />

      <Atmosphere />
      <OrbitalRings />
      <GlobeGroup
        students={students}
        activeId={activeId}
        focusKey={focusKey}
        userInteractingRef={userInteractingRef}
        onSelect={onSelect}
      />

      <OrbitControls
        ref={controlsRef}
        enableZoom={false}
        enablePan={false}
        enableRotate
        autoRotate={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.65}
        makeDefault
        onStart={() => {
          userInteractingRef.current = true;
        }}
      />
    </>
  );
}

interface StudentGlobeProps {
  students: AppStudent[];
  activeId: string | null;
  focusKey: number;
  showDesktopTooltip?: boolean;
  onSelect: (id: string) => void;
  className?: string;
}

export function StudentGlobe({
  students,
  activeId,
  focusKey,
  showDesktopTooltip = true,
  onSelect,
  className,
}: StudentGlobeProps) {
  return (
    <div className={cn("relative w-full h-full bg-transparent flex items-center justify-center", className)}>
      <Canvas
        className="w-full h-full bg-transparent"
        camera={{ position: CAM, fov: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        style={{ background: "transparent", touchAction: "none" }}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />

        <Suspense fallback={null}>
          <GlobeScene
            students={students}
            activeId={activeId}
            focusKey={focusKey}
            onSelect={onSelect}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
