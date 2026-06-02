import type { MoveSession } from '../systems/ObjectEditSystem';

/** Pen id to show again after move confirm (session is cleared once move is applied). */
export function penIdAfterConfirmedMove(session: MoveSession | null): string | null {
  if (!session || session.payload.kind !== 'pen') return null;
  return session.payload.pen.id;
}
