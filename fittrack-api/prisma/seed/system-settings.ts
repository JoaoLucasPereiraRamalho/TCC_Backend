/** Valores iniciais dos parâmetros de negócio (ERS 5.1). Alterá-los não exige deploy. */
export const SYSTEM_SETTINGS_SEED: Record<string, unknown> = {
  weeklyGoalDays: 5,
  validDayMinCompletedSetsPercent: 50,
  validDayMinDurationMinutes: 15,
  lateSyncWindowDays: 7,
  sessionEditWindowHours: 24,
  inviteExpiresInDays: 7,
  sessionAutoCloseInactivityHours: 4,
};
