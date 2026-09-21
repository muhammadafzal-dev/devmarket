export type User = {
  id: string;
  name: string;
  email: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
  emailVerified: boolean;
  connectAccountId: string | null;
  connectReady: boolean;
};
export type Service = {
  id: string;
  title: string;
  description: string;
  category: string;
  priceCents: number;
  deliveryDays: number;
  published: boolean;
  seller: { id: string; name: string };
  createdAt: string;
};
export type Order = {
  id: string;
  title: string;
  requirements: string;
  totalCents: number;
  feeCents: number;
  sellerCents: number;
  currency: string;
  status: string;
  paymentStatus: string;
  transferStatus: string;
  paymentMode: string;
  buyer: { id: string; name: string };
  seller: { id: string; name: string };
  deliveryMessage?: string;
  deliveryUrl?: string;
  revisionNote?: string;
  createdAt: string;
  updatedAt: string;
  events: { id: string; action: string; message: string; createdAt: string }[];
};
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const res = await fetch("/api" + path, {
    credentials: "include",
    method: method || (body === undefined ? "GET" : "POST"),
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res
    .json()
    .catch(() => ({ error: "The server returned an unexpected response." }));
  if (!res.ok)
    throw new Error(data.error || "Request failed. Please try again.");
  return data;
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const label = (s: string) => s.toLowerCase().replaceAll("_", " ");
