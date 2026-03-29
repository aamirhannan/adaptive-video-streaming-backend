export type Role = 'admin' | 'editor' | 'viewer';

export type AuthUser = {
  userId: string;
  email: string;
  role: Role;
};
