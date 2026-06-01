import Phaser from 'phaser';
import { FarmTool } from '../config/gameConfig';
import { HUD_MENU_DEPTH } from './BottomMenu';
import { hudSpan, topHudBandHeight } from './hudLayout';

const TOOL_BAR_ASPECT = 0.22;

const TOOL_DEFS: { tool: FarmTool; texture: string; label: string }[] = [
  { tool: FarmTool.HOE, texture: 'shovel', label: 'Hoe' },
  { tool: FarmTool.SEED, texture: 'seed', label: 'Seed' },
  { tool: FarmTool.WATERING_CAN, texture: 'watering_can', label: 'Water' },
  { tool: FarmTool.HARVEST_HAND, texture: 'harvest', label: 'Pick' },
];

export class ToolBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private selected: FarmTool = FarmTool.HOE;
  private buttons = new Map<FarmTool, Phaser.GameObjects.Rectangle>();
  private onChange?: (tool: FarmTool) => void;
  private viewW: number;
  private viewH: number;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.viewW = width;
    this.viewH = height;
    this.container = scene.add.container(0, 0, []);
    this.container.setDepth(HUD_MENU_DEPTH);
    this.container.setScrollFactor(0);
    this.rebuild();
  }

  resize(width: number, height: number): void {
    this.viewW = width;
    this.viewH = height;
    this.rebuild();
  }

  private rebuild(): void {
    this.container.removeAll(true);
    this.buttons.clear();

    const barW = Math.min(this.viewW * 0.88, 480);
    const barH = Math.round(barW * TOOL_BAR_ASPECT);
    const cx = this.viewW / 2;
    const topBand = topHudBandHeight(this.viewW, this.viewH);
    const y = topBand + hudSpan(20, this.viewW, this.viewH) + barH / 2;

    const children: Phaser.GameObjects.GameObject[] = [];

    const spacing = barW / (TOOL_DEFS.length + 1);

    TOOL_DEFS.forEach((def, i) => {
      const x = cx - barW / 2 + spacing * (i + 1);

      const hit = this.scene.add
        .rectangle(x, y, 64, 44, 0x000000, 0.001)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });

      const icon = this.scene.add.image(x, y - 4, def.texture).setScrollFactor(0);
      icon.setDisplaySize(28, 28);

      const label = this.scene.add
        .text(x, y + 14, def.label, { fontSize: '9px', color: '#ecf0f1', fontFamily: 'Arial' })
        .setOrigin(0.5)
        .setScrollFactor(0);

      hit.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          event?: Phaser.Types.Input.EventData
        ) => {
          event?.stopPropagation();
          this.select(def.tool);
        }
      );

      this.buttons.set(def.tool, hit);
      children.push(hit, icon, label);
    });

    this.container.add(children);
    this.highlightSelected();
  }

  select(tool: FarmTool): void {
    this.selected = tool;
    this.highlightSelected();
    this.onChange?.(tool);
  }

  getSelected(): FarmTool {
    return this.selected;
  }

  setSelected(tool: FarmTool): void {
    this.selected = tool;
    this.highlightSelected();
  }

  setOnChange(cb: (tool: FarmTool) => void): void {
    this.onChange = cb;
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  isVisible(): boolean {
    return this.container.visible;
  }

  hitsPointer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.container.visible) return false;
    const hits = this.scene.input.hitTestPointer(pointer);
    return hits.some(
      (obj) =>
        this.container.list.includes(obj) ||
        (obj.parentContainer != null && obj.parentContainer === this.container)
    );
  }

  private highlightSelected(): void {
    for (const [tool, rect] of this.buttons) {
      const active = tool === this.selected;
      rect.setFillStyle(0x000000, 0.001);
      rect.setStrokeStyle(active ? 2 : 0, active ? 0xf1c40f : 0x000000);
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
