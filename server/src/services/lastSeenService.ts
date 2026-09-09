import { prisma } from '../lib/prisma.js';

const THROTTLE_MS = 5 * 60 * 1000;
const lastTouch = new Map<string, number>();

export function touchLastSeen(userId: string) {
  const now = Date.now();
  const prev = lastTouch.get(userId) ?? 0;
  if (now - prev < THROTTLE_MS) return;
  lastTouch.set(userId, now);
  void prisma.user
    .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
    .catch(() => {
      /* ignore */
    });
}
