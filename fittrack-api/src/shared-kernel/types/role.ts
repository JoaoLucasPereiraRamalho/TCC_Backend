export const ROLES = ['TRAINER', 'STUDENT'] as const;
export type Role = (typeof ROLES)[number];
