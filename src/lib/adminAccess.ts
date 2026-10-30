export const ADMIN_EMAIL = 'mandiajayant@gmail.com';

export function canAccessAdminPortal(email: string | undefined | null) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}
