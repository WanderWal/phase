import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { RootState } from "@react-three/fiber";
import { usePreferencesStore } from "../../stores/preferencesStore";

const Canvas = lazy(() =>
  import("@react-three/fiber").then(({ Canvas }) => ({ default: Canvas })),
);
const motionQuery = "(prefers-reduced-motion: reduce)";

function motionPreference(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(motionQuery).matches
    : false;
}

function subscribeToMotionPreference(notify: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

function supportsWebGL2(): boolean {
  if (typeof document === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

interface SceneErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
}

class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface SceneCanvasProps {
  children: (reducedMotion: boolean) => ReactNode;
  fallback: ReactNode;
  className?: string;
}

export function SceneCanvas({ children, fallback, className }: SceneCanvasProps) {
  const presentation = usePreferencesStore((state) => state.boardPresentation);
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    motionPreference,
    () => false,
  );
  const [support, setSupport] = useState<"checking" | "supported" | "unsupported">("checking");
  const [contextLost, setContextLost] = useState(false);
  const [generation, setGeneration] = useState(0);
  const detachContextListeners = useRef<() => void>(() => {});

  useEffect(() => {
    if (presentation === "2d") {
      detachContextListeners.current();
      setContextLost(false);
      setSupport("checking");
      return;
    }
    setSupport(supportsWebGL2() ? "supported" : "unsupported");
  }, [presentation]);

  useEffect(() => () => detachContextListeners.current(), []);

  const onCreated = useCallback((state: RootState) => {
    detachContextListeners.current();
    const canvas = state.gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => {
      detachContextListeners.current();
      setGeneration((previous) => previous + 1);
      setContextLost(false);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    detachContextListeners.current = () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, []);

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      {presentation === "3d" && support === "supported" ? (
        <>
          <div style={{ width: "100%", height: "100%", visibility: contextLost ? "hidden" : "visible" }}>
            <SceneErrorBoundary
              key={generation}
              fallback={fallback}
              onError={() => detachContextListeners.current()}
            >
              <Suspense fallback={fallback}>
                <Canvas
                  dpr={[1, 2]}
                  frameloop="demand"
                  fallback={fallback}
                  onCreated={onCreated}
                >
                  {children(reducedMotion)}
                </Canvas>
              </Suspense>
            </SceneErrorBoundary>
          </div>
          {contextLost && (
            <div style={{ position: "absolute", inset: 0 }}>{fallback}</div>
          )}
        </>
      ) : fallback}
    </div>
  );
}
