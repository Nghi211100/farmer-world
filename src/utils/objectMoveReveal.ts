import type { LivestockPenData } from '../config/LivestockConfig';
import type { MoveSession } from '../systems/ObjectEditSystem';

/** Pen id to show again after move confirm (session is cleared once move is applied). */
export function penIdAfterConfirmedMove(session: MoveSession | null): string | null {
  if (!session || session.payload.kind !== 'pen') return null;
  return session.payload.pen.id;
}

/** Resolve pen record after grid move (anchor may differ from session snapshot). */
export function penDataAfterMove(
  pens: readonly LivestockPenData[],
  session: MoveSession,
  anchorGx: number,
  anchorGy: number
): LivestockPenData | undefined {
  if (session.payload.kind !== 'pen') return undefined;
  const penId = session.payload.pen.id;
  return (
    pens.find((p) => p.id === penId) ??
    pens.find((p) => p.gridX === anchorGx && p.gridY === anchorGy)
  );
}

/** Building sprite map key at grid anchor. */
export function buildingSpriteKeyAt(gx: number, gy: number): string {
  return `${gx},${gy}`;
}
