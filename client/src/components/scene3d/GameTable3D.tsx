import { useEffect, useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import type { GameState, ObjectId } from "../../adapter/types.ts";
import { GameCard3D, SCENE_CARD_HEIGHT } from "./GameCard3D.tsx";
import { ScenePositionBridge, type SceneCardAnchor } from "./ScenePositionBridge.tsx";

function SceneCamera() {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    camera.position.set(0, 10.5, 12);
    camera.lookAt(0, 0, 0);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = 42;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, height, invalidate, width]);
  return null;
}

interface GameTable3DProps {
  gameState: GameState;
  playerId: number;
  selectedObjectId: ObjectId | null;
  onSelect: (id: ObjectId | null) => void;
  onReady: () => void;
}

function placeSide(
  ids: ObjectId[],
  objects: GameState["objects"],
  side: -1 | 1,
): SceneCardAnchor[] {
  const rows = Math.ceil(ids.length / 7);
  const outerRowCenter = 4.15;
  const centerGap = 0.15;
  const rowSpacing = 1.7;
  const scale = Math.min(
    1,
    (outerRowCenter - centerGap) / (SCENE_CARD_HEIGHT + Math.max(rows - 1, 0) * rowSpacing),
  );
  return ids.map((objectId, index) => {
    const row = Math.floor(index / 7);
    const rowCount = Math.min(7, ids.length - row * 7);
    const column = index % 7;
    const position: [number, number, number] = [
      (column - (rowCount - 1) / 2) * 1.55 * scale,
      0.065,
      side * (outerRowCenter - SCENE_CARD_HEIGHT * scale / 2 - row * rowSpacing * scale),
    ];
    return {
      objectId,
      position,
      scale,
      tapped: objects[objectId].tapped,
    };
  });
}

export function GameTable3D({ gameState, playerId, selectedObjectId, onSelect, onReady }: GameTable3DProps) {
  useEffect(() => onReady(), [onReady]);
  const placements = useMemo(() => {
    const own: ObjectId[] = [];
    const opponent: ObjectId[] = [];
    for (const objectId of gameState.battlefield) {
      const object = gameState.objects[objectId];
      if (!object || object.zone !== "Battlefield") continue;
      (object.controller === playerId ? own : opponent).push(objectId);
    }
    return [
      ...placeSide(opponent, gameState.objects, -1),
      ...placeSide(own, gameState.objects, 1),
    ];
  }, [gameState, playerId]);

  return (
    <>
      <SceneCamera />
      <color attach="background" args={["#0b1117"]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[2, 8, 4]} intensity={2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={() => onSelect(null)}>
        <planeGeometry args={[16, 10]} />
        <meshStandardMaterial color="#203a33" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[15, 0.02, 0.022]} />
        <meshBasicMaterial color="#a47d50" />
      </mesh>
      {placements.map((anchor) => {
        const object = gameState.objects[anchor.objectId];
        return (
          <GameCard3D
            key={anchor.objectId}
            object={object}
            position={anchor.position}
            scale={anchor.scale}
            selected={selectedObjectId === anchor.objectId}
            onSelect={onSelect}
          />
        );
      })}
      <ScenePositionBridge anchors={placements} />
    </>
  );
}
