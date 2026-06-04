import Phaser from 'phaser';
import type { FarmFootprintBounds } from '../farmCameraScroll';
import { GRID_SIZE, MAX_GAME_HEIGHT, MAX_GAME_WIDTH } from '../config/gameConfig';
import { computePlayableFarmViewportLayout } from '../ui/hudLayout';
import { drawIsoRhombusDebugDashed, type IsoScreenRhombus } from './iso';
import {
  farmBackgroundOnlyHudLabel,
  farmCameraVisibleWorldRect,
  farmFootprintDebugLabel,
  farmMapDebugLabel,
  farmMapDebugTileCount,
  farmMapWorldEndsDebugLabel,
  farmPanBoundsDebugLabel,
  farmCenterDebugMapViewportMergedTitle,
  farmCenterDebugMarkerLabelBlock,
  farmDebugWorldPointsCoincide,
  farmViewportDebugGridStepX,
  farmViewportDebugGridStepY,
  farmViewportExtendsBeyondBounds,
  farmFootprintWorldRect,
  farmWorldToScreen,
  playableBandScreenRect,
  type FarmCameraScreenTransform,
} from './farmViewportDebugLayout';

export {
  farmCenterDebugMapViewportMergedTitle,
  farmCenterDebugMarkerLabelBlock,
  farmDebugWorldPointsCoincide,
  farmViewportCenterWorldAtScroll,
  farmWorldToScreen,
  FARM_DEBUG_CENTER_DOT_MERGE_EPS,
  formatFarmDebugCoord,
  type FarmCameraScreenTransform,
} from './farmViewportDebugLayout';

export {
  farmBackgroundOnlyHudLabel,
  farmCameraVisibleWorldRect,
  farmFootprintDebugLabel,
  farmMapDebugLabel,
  farmMapWorldEndsDebugLabel,
  farmPanBoundsDebugLabel,
  farmViewportExtendsBeyondBounds,
} from './farmViewportDebugLayout';

/** Full logical canvas (background cover target). */
export const FARM_DEBUG_FULL_VIEWPORT_COLOR = 0x4488ff;
/** Full iso map AABB in world space (GRID_SIZE × GRID_SIZE). */
export const FARM_DEBUG_MAP_COLOR = 0x66aaff;
/** Dashed accent on the map outer edge (world ends). */
export const FARM_DEBUG_MAP_EDGE_DASH_COLOR = 0x99ddff;
/** Screen-fixed hint when the view shows void past the logical map. */
export const FARM_DEBUG_BACKGROUND_ONLY_COLOR = 0x8899bb;
/** Camera pan clamp universe (island image AABB). */
export const FARM_DEBUG_PAN_BOUNDS_COLOR = 0xffa726;
/** Tile soil + path ring footprint (smaller than pan bounds when island is loaded). */
export const FARM_DEBUG_FOOTPRINT_COLOR = 0x18ffff;
/** Screen-fixed HUD playable clamp band. */
export const FARM_DEBUG_PLAYABLE_HUD_COLOR = 0xdfe963;
export const FARM_DEBUG_GRID_ALPHA = 0.55;
export const FARM_DEBUG_MAP_GRID_ALPHA = 0.35;
export const FARM_DEBUG_PAN_GRID_ALPHA = 0.72;
export const FARM_DEBUG_BORDER_ALPHA = 0.85;
export const FARM_DEBUG_PAN_BORDER_WIDTH = 3;
export const FARM_DEBUG_MAP_BORDER_WIDTH = 3;
export const FARM_DEBUG_MAP_EDGE_DASH_ALPHA = 0.9;
export const FARM_DEBUG_FOOTPRINT_BORDER_WIDTH = 2;

const LABEL_STYLE = {
  fontSize: '10px',
  fontFamily: 'monospace',
  align: 'center' as const,
};

function applyWorldScrollFactor(children: Phaser.GameObjects.GameObject[]): void {
  for (const child of children) {
    if ('setScrollFactor' in child && typeof child.setScrollFactor === 'function') {
      child.setScrollFactor(1);
    }
    if ('disableInteractive' in child && typeof child.disableInteractive === 'function') {
      child.disableInteractive();
    }
  }
}

function applyHudScrollFactor(children: Phaser.GameObjects.GameObject[]): void {
  for (const child of children) {
    if ('setScrollFactor' in child && typeof child.setScrollFactor === 'function') {
      child.setScrollFactor(0);
    }
    if ('disableInteractive' in child && typeof child.disableInteractive === 'function') {
      child.disableInteractive();
    }
  }
}

export type FarmWorldDebugGridOptions = {
  /** Full logical map bounds (all GRID_SIZE cells, grass/water/moat included). */
  map: FarmFootprintBounds;
  /** Camera pan clamp target (`getFarmCameraScrollBounds` — island AABB). */
  panBounds?: FarmFootprintBounds;
  /** Tile soil + path ring AABB (`getFarmFootprintScreenBounds`). */
  footprint?: FarmFootprintBounds;
  /** Outer iso rhombus for footprint (drawn instead of axis-aligned AABB rect). */
  footprintRhombus?: IsoScreenRhombus;
  /** Logical tile count for labels (defaults to GRID_SIZE²). */
  tileCount?: number;
  /** Grid dimension for labels (defaults to GRID_SIZE). */
  gridSize?: number;
};

function strokeAxisAlignedGrid(
  g: Phaser.GameObjects.Graphics,
  rect: { left: number; top: number; width: number; height: number },
  color: number,
  alpha: number,
  stepX: number,
  stepY: number,
  lineWidth = 1
): void {
  g.lineStyle(lineWidth, color, alpha);
  for (let x = rect.left; x <= rect.left + rect.width + 0.5; x += stepX) {
    g.strokeLineShape(new Phaser.Geom.Line(x, rect.top, x, rect.top + rect.height));
  }
  for (let y = rect.top; y <= rect.top + rect.height + 0.5; y += stepY) {
    g.strokeLineShape(
      new Phaser.Geom.Line(rect.left, y, rect.left + rect.width, y)
    );
  }
}

function strokeBoundsBorder(
  g: Phaser.GameObjects.Graphics,
  rect: { left: number; top: number; width: number; height: number },
  color: number,
  alpha: number,
  lineWidth: number
): void {
  g.lineStyle(lineWidth, color, alpha);
  g.strokeRect(rect.left, rect.top, rect.width, rect.height);
}

function strokeDashedRect(
  g: Phaser.GameObjects.Graphics,
  rect: { left: number; top: number; width: number; height: number },
  color: number,
  alpha: number,
  dash = 10,
  gap = 6,
  lineWidth = 1
): void {
  g.lineStyle(lineWidth, color, alpha);
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const segments: [number, number, number, number][] = [
    [rect.left, rect.top, right, rect.top],
    [right, rect.top, right, bottom],
    [right, bottom, rect.left, bottom],
    [rect.left, bottom, rect.left, rect.top],
  ];
  for (const [x1, y1, x2, y2] of segments) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.floor(len / (dash + gap)));
    for (let i = 0; i < steps; i++) {
      const t0 = (i * (dash + gap)) / len;
      const t1 = Math.min(1, (i * (dash + gap) + dash) / len);
      if (t1 <= t0) continue;
      g.strokeLineShape(
        new Phaser.Geom.Line(
          x1 + (x2 - x1) * t0,
          y1 + (y2 - y1) * t0,
          x1 + (x2 - x1) * t1,
          y1 + (y2 - y1) * t1
        )
      );
    }
  }
}

function strokeMapCornerMarkers(
  g: Phaser.GameObjects.Graphics,
  rect: { left: number; top: number; width: number; height: number },
  color: number,
  alpha: number,
  arm = 14,
  lineWidth = 2
): void {
  g.lineStyle(lineWidth, color, alpha);
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const corners: [number, number, number, number][] = [
    [rect.left, rect.top, 1, 1],
    [right, rect.top, -1, 1],
    [right, bottom, -1, -1],
    [rect.left, bottom, 1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    g.strokeLineShape(new Phaser.Geom.Line(cx, cy, cx + sx * arm, cy));
    g.strokeLineShape(new Phaser.Geom.Line(cx, cy, cx, cy + sy * arm));
  }
}

/**
 * World-space debug overlay: full iso map, camera pan bounds (prominent), optional footprint.
 * Grid and outlines scroll with the camera (`scrollFactor` 1).
 */
export function buildFarmWorldDebugGridOverlay(
  scene: Phaser.Scene,
  options: FarmWorldDebugGridOptions
): Phaser.GameObjects.Container {
  const {
    map,
    panBounds,
    footprint,
    footprintRhombus,
    tileCount = farmMapDebugTileCount(),
    gridSize = GRID_SIZE,
  } = options;
  const mapRect = farmFootprintWorldRect(map);
  const panRect = panBounds ? farmFootprintWorldRect(panBounds) : undefined;
  const footprintRect = footprint ? farmFootprintWorldRect(footprint) : undefined;
  const footprintLabelCenter = footprintRhombus?.center;
  const stepX = farmViewportDebugGridStepX();
  const stepY = farmViewportDebugGridStepY();
  const g = scene.add.graphics();
  const labels: Phaser.GameObjects.Text[] = [];

  strokeAxisAlignedGrid(
    g,
    mapRect,
    FARM_DEBUG_MAP_COLOR,
    FARM_DEBUG_MAP_GRID_ALPHA,
    stepX,
    stepY
  );
  strokeBoundsBorder(
    g,
    mapRect,
    FARM_DEBUG_MAP_COLOR,
    FARM_DEBUG_BORDER_ALPHA,
    FARM_DEBUG_MAP_BORDER_WIDTH
  );
  strokeDashedRect(
    g,
    mapRect,
    FARM_DEBUG_MAP_EDGE_DASH_COLOR,
    FARM_DEBUG_MAP_EDGE_DASH_ALPHA,
    12,
    5,
    1
  );
  strokeMapCornerMarkers(g, mapRect, FARM_DEBUG_MAP_COLOR, FARM_DEBUG_BORDER_ALPHA);

  if (footprintRhombus) {
    drawIsoRhombusDebugDashed(
      g,
      footprintRhombus,
      FARM_DEBUG_FOOTPRINT_COLOR,
      FARM_DEBUG_BORDER_ALPHA * 0.85,
      8,
      5,
      FARM_DEBUG_FOOTPRINT_BORDER_WIDTH
    );
  }

  if (panRect) {
    strokeAxisAlignedGrid(
      g,
      panRect,
      FARM_DEBUG_PAN_BOUNDS_COLOR,
      FARM_DEBUG_PAN_GRID_ALPHA,
      stepX,
      stepY,
      1
    );
    strokeBoundsBorder(
      g,
      panRect,
      FARM_DEBUG_PAN_BOUNDS_COLOR,
      FARM_DEBUG_BORDER_ALPHA,
      FARM_DEBUG_PAN_BORDER_WIDTH
    );
  }

  labels.push(
    scene.add
      .text(
        mapRect.left + mapRect.width / 2,
        mapRect.top + 4,
        farmMapDebugLabel(mapRect, tileCount, gridSize, stepX, stepY),
        { ...LABEL_STYLE, color: '#88ccff' }
      )
      .setOrigin(0.5, 0)
  );
  labels.push(
    scene.add
      .text(
        mapRect.left + mapRect.width / 2,
        mapRect.top + mapRect.height - 4,
        farmMapWorldEndsDebugLabel(),
        { ...LABEL_STYLE, color: '#cceeff', fontStyle: 'bold' }
      )
      .setOrigin(0.5, 1)
  );

  if (footprintRect) {
    const labelX = footprintLabelCenter?.x ?? footprintRect.left + footprintRect.width / 2;
    const labelY = footprintLabelCenter?.y ?? footprintRect.top + footprintRect.height / 2;
    labels.push(
      scene.add
        .text(labelX, labelY, farmFootprintDebugLabel(footprintRect), {
          ...LABEL_STYLE,
          color: '#66eeff',
        })
        .setOrigin(0.5, 0.5)
    );
  }

  if (panRect) {
    labels.push(
      scene.add
        .text(
          panRect.left + panRect.width / 2,
          panRect.top + panRect.height - 4,
          farmPanBoundsDebugLabel(panRect),
          { ...LABEL_STYLE, color: '#ffc266', fontStyle: 'bold' }
        )
        .setOrigin(0.5, 1)
    );
  }

  const container = scene.add.container(0, 0, [g, ...labels]);
  applyWorldScrollFactor(container.list);
  return container;
}

export type FarmViewportHudDebugOptions = {
  /** Full logical map bounds — used to detect background-only void in view. */
  map?: FarmFootprintBounds;
  /** Camera pan clamp (island AABB). */
  panBounds?: FarmFootprintBounds;
  scrollX?: number;
  scrollY?: number;
  zoom?: number;
};

export type FarmViewportHudDebugOverlay = Phaser.GameObjects.Container & {
  voidHintLabel?: Phaser.GameObjects.Text;
};

/** Update the screen-fixed void hint after pan/zoom (call from scene update when debug is on). */
export function refreshFarmViewportHudVoidHint(
  overlay: FarmViewportHudDebugOverlay,
  viewW: number,
  viewH: number,
  options: FarmViewportHudDebugOptions
): void {
  const label = overlay.voidHintLabel;
  if (!label || options.map === undefined) return;

  const scrollX = options.scrollX ?? 0;
  const scrollY = options.scrollY ?? 0;
  const zoom = options.zoom ?? 1;
  const visible = farmCameraVisibleWorldRect(scrollX, scrollY, zoom, viewW, viewH);
  const beyondMap = farmViewportExtendsBeyondBounds(visible, options.map);
  const beyondPan =
    options.panBounds !== undefined &&
    farmViewportExtendsBeyondBounds(visible, options.panBounds);

  if (!beyondMap && !beyondPan) {
    label.setVisible(false);
    return;
  }

  const beyond =
    beyondMap && beyondPan ? 'map+pan' : beyondMap ? 'map' : 'pan';
  label.setText(farmBackgroundOnlyHudLabel(beyond));
  label.setVisible(true);
  label.setPosition(viewW - 8, viewH - 8);
}

/**
 * Screen-fixed viewport HUD (device canvas + playable clamp band). Outlines only — no tile grid.
 */
export function buildFarmViewportHudDebugOverlay(
  scene: Phaser.Scene,
  viewW: number,
  viewH: number,
  padX: number,
  padY: number,
  options: FarmViewportHudDebugOptions = {}
): FarmViewportHudDebugOverlay {
  const layout = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
  const playable = playableBandScreenRect(layout);
  const g = scene.add.graphics();
  const labels: Phaser.GameObjects.Text[] = [];

  g.lineStyle(1, FARM_DEBUG_FULL_VIEWPORT_COLOR, FARM_DEBUG_BORDER_ALPHA * 0.65);
  g.strokeRect(0, 0, viewW, viewH);
  labels.push(
    scene.add
      .text(
        viewW / 2,
        4,
        `viewport HUD ${viewW}×${viewH} (screen-fixed, art ref ${MAX_GAME_WIDTH}×${MAX_GAME_HEIGHT})`,
        { ...LABEL_STYLE, color: '#88bbff' }
      )
      .setOrigin(0.5, 0)
  );

  g.lineStyle(2, FARM_DEBUG_PLAYABLE_HUD_COLOR, FARM_DEBUG_BORDER_ALPHA * 0.45);
  g.strokeRect(playable.left, playable.top, playable.width, playable.height);
  labels.push(
    scene.add
      .text(
        playable.left + playable.width / 2,
        playable.top + 4,
        `playable HUD clamp ${Math.round(playable.width)}×${Math.round(playable.height)} (not pan bounds)`,
        { ...LABEL_STYLE, color: '#a8b040' }
      )
      .setOrigin(0.5, 0)
  );

  const voidHintLabel = scene.add
    .text(0, 0, '', {
      ...LABEL_STYLE,
      color: '#b0c0dd',
      fontSize: '11px',
      align: 'right',
      backgroundColor: '#0a1020cc',
      padding: { x: 6, y: 4 },
    })
    .setOrigin(1, 1)
    .setVisible(false);
  labels.push(voidHintLabel);

  const container = scene.add.container(0, 0, [g, ...labels]) as FarmViewportHudDebugOverlay;
  container.voidHintLabel = voidHintLabel;
  applyHudScrollFactor(container.list);
  refreshFarmViewportHudVoidHint(container, viewW, viewH, options);
  return container;
}

/** @deprecated Use {@link buildFarmWorldDebugGridOverlay} + {@link buildFarmViewportHudDebugOverlay}. */
export function buildFarmViewportDebugOverlay(
  scene: Phaser.Scene,
  viewW: number,
  viewH: number,
  padX: number,
  padY: number
): Phaser.GameObjects.Container {
  return buildFarmViewportHudDebugOverlay(scene, viewW, viewH, padX, padY);
}

/** @deprecated Renamed to {@link FARM_DEBUG_PAN_BOUNDS_COLOR}. */
export const FARM_DEBUG_PLAYABLE_COLOR = FARM_DEBUG_PAN_BOUNDS_COLOR;

export const FARM_DEBUG_CENTER_DOT_COLOR = 0xff2222;
export const FARM_DEBUG_CENTER_DOT_RADIUS = 5;
export const FARM_DEBUG_CENTER_DOT_DEPTH = 10001;

const CENTER_DOT_LABEL_STYLE = {
  fontSize: '10px',
  fontFamily: 'monospace',
  color: '#ffcccc',
  backgroundColor: '#1a0000dd',
  padding: { x: 4, y: 3 },
  align: 'center' as const,
  lineSpacing: 1,
};

export type FarmCenterDebugMarkerPositions = {
  /** Dot A: 20×20 map AABB center (world). */
  mapCenterWorld: { x: number; y: number };
  /** Interpolated HUD screen target for map center at current zoom. */
  mapCenterScreenTarget: { x: number; y: number };
  /** World delta from 1.9 bake baseline at current zoom (keyframes). */
  mapCenterWorldOffset?: { x: number; y: number };
  /** Camera zoom for HUD label. */
  mapCenterZoom?: number;
  /** Dot B: world point at camera scroll (scroll origin). */
  scrollOriginWorld: { x: number; y: number };
  /** Dot C: viewport optical center in world at current scroll. */
  viewportCenterWorld: { x: number; y: number };
};

export type FarmCenterDebugMarkersOverlay = {
  container: Phaser.GameObjects.Container;
  refresh: (
    positions: FarmCenterDebugMarkerPositions,
    cam: FarmCameraScreenTransform
  ) => void;
  destroy: () => void;
};

function strokeFilledCircle(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  color: number
): void {
  g.fillStyle(color, 1);
  g.fillCircle(x, y, radius);
  g.lineStyle(1, 0xffffff, 0.6);
  g.strokeCircle(x, y, radius);
}

function placeCenterDebugLabelBelow(
  label: Phaser.GameObjects.Text,
  screenX: number,
  screenY: number,
  dotRadius: number,
  viewW: number,
  viewH: number
): void {
  const pad = dotRadius + 6;
  let x = screenX;
  let y = screenY + pad;
  label.setOrigin(0.5, 0);
  const halfW = Math.max(label.width, 80) / 2;
  const halfH = Math.max(label.height, 48);
  x = Phaser.Math.Clamp(x, halfW + 4, viewW - halfW - 4);
  y = Phaser.Math.Clamp(y, 4, viewH - halfH - 4);
  label.setPosition(x, y);
}

function placeScrollOriginDebugLabel(
  label: Phaser.GameObjects.Text,
  screenX: number,
  screenY: number,
  dotRadius: number,
  viewW: number,
  viewH: number
): void {
  const pad = dotRadius + 6;
  const nearTopLeft = screenX < 48 && screenY < 48;
  if (nearTopLeft) {
    label.setOrigin(0, 0);
    label.setPosition(
      Phaser.Math.Clamp(screenX + pad, 4, viewW - Math.max(label.width, 120) - 4),
      Phaser.Math.Clamp(screenY + pad, 4, viewH - Math.max(label.height, 56) - 4)
    );
    return;
  }
  placeCenterDebugLabelBelow(label, screenX, screenY, dotRadius, viewW, viewH);
}

/**
 * World-space red dots: playable map center (A), camera scroll origin (B), viewport optical center (C).
 * After bake + scroll, A and C coincide — one dot on the farmer, merged label. B stays separate.
 * Labels are screen-fixed HUD text under each dot (title + world + screen coords).
 */
export function buildFarmCenterDebugMarkers(
  scene: Phaser.Scene,
  viewW: number,
  viewH: number
): FarmCenterDebugMarkersOverlay {
  const g = scene.add.graphics();
  g.setScrollFactor(0);
  g.setDepth(FARM_DEBUG_CENTER_DOT_DEPTH);

  const labelMap = scene.add.text(0, 0, '', CENTER_DOT_LABEL_STYLE).setScrollFactor(0);
  const labelScroll = scene.add.text(0, 0, '', CENTER_DOT_LABEL_STYLE).setScrollFactor(0);
  const labelViewport = scene.add.text(0, 0, '', CENTER_DOT_LABEL_STYLE).setScrollFactor(0);
  for (const label of [labelMap, labelScroll, labelViewport]) {
    label.setDepth(FARM_DEBUG_CENTER_DOT_DEPTH + 1);
    label.disableInteractive();
  }

  const container = scene.add.container(0, 0, [g]);
  container.setScrollFactor(0);
  container.setDepth(FARM_DEBUG_CENTER_DOT_DEPTH);

  const refresh = (
    positions: FarmCenterDebugMarkerPositions,
    cam: FarmCameraScreenTransform
  ) => {
    g.clear();
    const r = FARM_DEBUG_CENTER_DOT_RADIUS;
    const color = FARM_DEBUG_CENTER_DOT_COLOR;
    const mergeMapViewport = farmDebugWorldPointsCoincide(
      positions.mapCenterWorld,
      positions.viewportCenterWorld
    );

    const toScreen = (wx: number, wy: number) => farmWorldToScreen(cam, wx, wy);
    const mapScreen = toScreen(positions.mapCenterWorld.x, positions.mapCenterWorld.y);
    const scrollScreen = toScreen(
      positions.scrollOriginWorld.x,
      positions.scrollOriginWorld.y
    );
    const viewportScreen = toScreen(
      positions.viewportCenterWorld.x,
      positions.viewportCenterWorld.y
    );

    strokeFilledCircle(g, scrollScreen.x, scrollScreen.y, r, color);
    if (mergeMapViewport) {
      strokeFilledCircle(g, mapScreen.x, mapScreen.y, r, color);
    } else {
      strokeFilledCircle(g, mapScreen.x, mapScreen.y, r, color);
      strokeFilledCircle(g, viewportScreen.x, viewportScreen.y, r, color);
    }

    const sx = positions.scrollOriginWorld.x;
    const sy = positions.scrollOriginWorld.y;

    const camScroll = { x: cam.scrollX, y: cam.scrollY };
    const mapTarget = positions.mapCenterScreenTarget;

    const worldOff = positions.mapCenterWorldOffset;
    const mapZoom = positions.mapCenterZoom;
    const mapLabelExtras =
      worldOff !== undefined && mapZoom !== undefined
        ? {
            worldOffsetX: worldOff.x,
            worldOffsetY: worldOff.y,
            zoom: mapZoom,
          }
        : {};

    if (mergeMapViewport) {
      labelMap.setVisible(true);
      labelMap.setText(
        farmCenterDebugMarkerLabelBlock({
          title: farmCenterDebugMapViewportMergedTitle(),
          worldX: positions.mapCenterWorld.x,
          worldY: positions.mapCenterWorld.y,
          screenX: mapScreen.x,
          screenY: mapScreen.y,
          scrollX: camScroll.x,
          scrollY: camScroll.y,
          targetScreenX: mapTarget.x,
          targetScreenY: mapTarget.y,
          ...mapLabelExtras,
        })
      );
      placeCenterDebugLabelBelow(labelMap, mapScreen.x, mapScreen.y, r, viewW, viewH);
      labelViewport.setVisible(false);
    } else {
      labelMap.setVisible(true);
      labelMap.setText(
        farmCenterDebugMarkerLabelBlock({
          title: 'map center (20×20 AABB)',
          worldX: positions.mapCenterWorld.x,
          worldY: positions.mapCenterWorld.y,
          screenX: mapScreen.x,
          screenY: mapScreen.y,
          scrollX: camScroll.x,
          scrollY: camScroll.y,
          targetScreenX: mapTarget.x,
          targetScreenY: mapTarget.y,
          ...mapLabelExtras,
        })
      );
      placeCenterDebugLabelBelow(labelMap, mapScreen.x, mapScreen.y, r, viewW, viewH);

      labelViewport.setVisible(true);
      labelViewport.setText(
        farmCenterDebugMarkerLabelBlock({
          title: 'viewport center',
          worldX: positions.viewportCenterWorld.x,
          worldY: positions.viewportCenterWorld.y,
          screenX: viewportScreen.x,
          screenY: viewportScreen.y,
        })
      );
      placeCenterDebugLabelBelow(
        labelViewport,
        viewportScreen.x,
        viewportScreen.y,
        r,
        viewW,
        viewH
      );
    }

    labelScroll.setVisible(true);
    labelScroll.setText(
      farmCenterDebugMarkerLabelBlock({
        title: 'scroll origin',
        worldX: sx,
        worldY: sy,
        screenX: scrollScreen.x,
        screenY: scrollScreen.y,
        scrollX: sx,
        scrollY: sy,
      })
    );
    placeScrollOriginDebugLabel(labelScroll, scrollScreen.x, scrollScreen.y, r, viewW, viewH);
  };

  return {
    container,
    refresh,
    destroy: () => {
      g.destroy();
      labelMap.destroy();
      labelScroll.destroy();
      labelViewport.destroy();
      container.destroy();
    },
  };
}
