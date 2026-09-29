import { useEffect, useMemo, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace, Texture, TextureLoader } from "three";
import type { GameObject, ObjectId } from "../../adapter/types.ts";
import { useCardImage } from "../../hooks/useCardImage.ts";
import { cardImageLookup, tokenFiltersForObject } from "../../services/cardImageLookup.ts";
import { useUiStore } from "../../stores/uiStore.ts";

export const SCENE_CARD_WIDTH = 1.08;
export const SCENE_CARD_HEIGHT = 1.51;

function labelTexture(name: string, faceDown: boolean): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 356;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = faceDown ? "#30233f" : "#e8dfcc";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = faceDown ? "#b99662" : "#4a3c2e";
    context.lineWidth = 12;
    context.strokeRect(10, 10, 236, 336);
    if (!faceDown) {
      context.fillStyle = "#211b19";
      context.font = "bold 24px serif";
      context.textAlign = "center";
      const words = name.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (context.measureText(next).width > 216 && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
      lines.slice(0, 4).forEach((text, index) => context.fillText(text, 128, 70 + index * 31));
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

interface GameCard3DProps {
  object: GameObject;
  position: [number, number, number];
  scale: number;
  selected: boolean;
  onSelect: (id: ObjectId) => void;
}

export function GameCard3D({ object, position, scale, selected, onSelect }: GameCard3DProps) {
  const inspectObject = useUiStore((state) => state.inspectObject);
  const image = cardImageLookup(object);
  const hidden = object.face_down || object.display_visible_to_viewer === false;
  const { src, advanceFailedSource } = useCardImage(hidden ? "" : image.name, {
    size: "small",
    faceIndex: image.faceIndex,
    oracleId: hidden ? undefined : image.oracleId,
    faceName: hidden ? undefined : image.faceName,
    isToken: !hidden && object.display_source === "Token",
    tokenFilters: !hidden && object.display_source === "Token" ? tokenFiltersForObject(object) : undefined,
    tokenImageRef: !hidden && object.display_source === "Token" ? object.token_image_ref : undefined,
  });
  const placeholder = useMemo(
    () => labelTexture(hidden ? "" : object.name, hidden),
    [hidden, object.name],
  );
  const [art, setArt] = useState<Texture | null>(null);

  useEffect(() => () => placeholder.dispose(), [placeholder]);
  useEffect(() => {
    if (!src || hidden) {
      setArt(null);
      return;
    }
    setArt(null);
    let active = true;
    let loaded: Texture | null = null;
    new TextureLoader().load(
      src,
      (texture) => {
        if (!active) {
          texture.dispose();
          return;
        }
        texture.colorSpace = SRGBColorSpace;
        loaded = texture;
        setArt(texture);
      },
      undefined,
      () => {
        if (active) {
          setArt(null);
          advanceFailedSource?.(src);
        }
      },
    );
    return () => {
      active = false;
      loaded?.dispose();
    };
  }, [advanceFailedSource, hidden, src]);

  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    inspectObject(object.id);
    onSelect(object.id);
  };

  return (
    <group position={position} rotation={[0, object.tapped ? Math.PI / 2 : 0, 0]} scale={scale}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 0]}>
        <planeGeometry args={[SCENE_CARD_WIDTH + 0.08, SCENE_CARD_HEIGHT + 0.08]} />
        <meshBasicMaterial color={selected ? "#e2b96e" : "#1d1815"} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={select}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
          inspectObject(object.id);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
          inspectObject(null);
        }}
      >
        <planeGeometry args={[SCENE_CARD_WIDTH, SCENE_CARD_HEIGHT]} />
        <meshBasicMaterial map={art ?? placeholder} toneMapped={false} />
      </mesh>
    </group>
  );
}
