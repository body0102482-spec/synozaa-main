const TOKEN_KEY = 'synoza_token';const USER_KEY = 'synoza_user';

export interface StoredUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'STUDENT' | 'ADMIN';
  university?: string;
  phone?: string;
  studentId?: string;
  avatarUrl?: string;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token: string, user: StoredUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function hasStoredSession(): boolean {
  return !!getStoredToken() && !!getStoredUser();
}

export function homePathForUser(user: StoredUser | null): string {
  if (!user) return '/login';
  return user.role === 'ADMIN' ? '/admin' : '/student';
}
