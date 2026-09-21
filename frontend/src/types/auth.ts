export interface AuthStatus {
  logged_in: boolean;
  uid: string | null;
}

export interface AuthResponse {
  success?: boolean;
  error?: string;
  redirect?: string;
}
