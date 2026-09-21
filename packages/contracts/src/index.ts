export type Role = "CLIENT" | "DEVELOPER" | "ADMIN";
export type PaymentMode = "demo" | "stripe";
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  connectAccountId: string | null;
  connectReady: boolean;
}
