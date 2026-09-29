import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { ObjectId } from "../../adapter/types.ts";
import { useAnimationStore } from "../../stores/animationStore.ts";
import { SCENE_CARD_HEIGHT, SCENE_CARD_WIDTH } from "./GameCard3D.tsx";

export interface SceneCardAnchor {
  objectId: ObjectId;
  position: [number, number, number];
  scale: number;
  tapped: boolean;
}

function projectedRect(
  camera: Parameters<Vector3["project"]>[0],
  canvasRect: DOMRect,
  anchor: SceneCardAnchor,
): DOMRect {
  const [x, y, z] = anchor.position;
  const halfX = (anchor.tapped ? SCENE_CARD_HEIGHT : SCENE_CARD_WIDTH) * anchor.scale / 2;
  const halfZ = (anchor.tapped ? SCENE_CARD_WIDTH : SCENE_CARD_HEIGHT) * anchor.scale / 2;
  const corners = [
    [x - halfX, y, z - halfZ],
    [x + halfX, y, z - halfZ],
    [x - halfX, y, z + halfZ],
    [x + halfX, y, z + halfZ],
  ];
  const points = corners.map(([worldX, worldY, worldZ]) => {
    const point = new Vector3(worldX, worldY, worldZ).project(camera);
    return {
      x: canvasRect.left + (point.x + 1) * canvasRect.width / 2,
      y: canvasRect.top + (1 - point.y) * canvasRect.height / 2,
    };
  });
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  return new DOMRect(left, top, right - left, bottom - top);
}

export function ScenePositionBridge({ anchors }: { anchors: readonly SceneCardAnchor[] }) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  useLayoutEffect(() => {
    camera.updateMatrixWorld();
    const canvasRect = canvas.getBoundingClientRect();
    const registered = new Map<ObjectId, DOMRect>();
    for (const anchor of anchors) {
      const rect = projectedRect(camera, canvasRect, anchor);
      registered.set(anchor.objectId, rect);
      useAnimationStore.getState().registerPosition(anchor.objectId, rect);
    }
    return () => {
      useAnimationStore.setState((state) => {
        const next = new Map(state.positionRegistry);
        for (const [id, rect] of registered) {
          if (next.get(id) === rect) next.delete(id);
        }
        return { positionRegistry: next };
      });
    };
  }, [anchors, camera, canvas, width, height]);

  return null;
}
