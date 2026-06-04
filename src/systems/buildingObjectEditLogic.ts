import { ECONOMY, type BuildingData } from '../config/gameConfig';
import type { BuildSystem } from './BuildSystem';
import type { EconomySystem } from './EconomySystem';

export type BuildingObjectEditAction = 'move' | 'upgrade' | 'remove';

export function buildingSupportsUpgrade(type: BuildingData['type']): boolean {
  return type === 'house' || type === 'barn';
}

export function getBuildingObjectEditHiddenActions(
  building: BuildingData
): BuildingObjectEditAction[] {
  if (!buildingSupportsUpgrade(building.type)) return ['upgrade'];
  if (building.level >= ECONOMY.maxBuildingLevel) return ['upgrade'];
  return [];
}

export function getBuildingObjectEditDisabledActions(
  building: BuildingData,
  build: BuildSystem,
  economy: EconomySystem
): BuildingObjectEditAction[] {
  if (getBuildingObjectEditHiddenActions(building).includes('upgrade')) return [];
  if (!build.canUpgrade(building) || !economy.canUpgradeBuilding(building.type, building.level)) {
    return ['upgrade'];
  }
  return [];
}

export function getBuildingObjectEditVisibleActions(
  building: BuildingData
): BuildingObjectEditAction[] {
  const hidden = new Set(getBuildingObjectEditHiddenActions(building));
  return (['move', 'upgrade', 'remove'] as const).filter((a) => !hidden.has(a));
}
