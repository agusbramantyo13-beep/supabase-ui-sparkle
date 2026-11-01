/** Receipt metadata only; the caller supplies the existing checkout points change. */
export function memberPointSnapshot(
  memberId: string | null | undefined,
  member: { id: string; points: number | null } | undefined,
  pointsChange: number,
  earnedPoints: number,
) {
  if (!memberId || memberId === "none" || member?.id !== memberId) {
    return { member_points_after: null, member_points_earned: null };
  }
  return {
    member_points_after: Math.max(0, (member.points || 0) + pointsChange),
    member_points_earned: earnedPoints,
  };
}