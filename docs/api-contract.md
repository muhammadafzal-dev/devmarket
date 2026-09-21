# API and implementation contract

Base `/api`, JSON, cookies included. Response errors `{error: string}` (optional details). Dates ISO strings, amounts integer cents, currency `usd`. Lists are wrapped as below. All browser mutations send Origin automatically, and server checks WEB_URL. Authenticated user serialization: `{id,name,email,role,emailVerified,connectAccountId,connectReady}` where role `CLIENT|DEVELOPER|ADMIN`. GET `/api/health` -> `{ok:true,paymentMode:"demo"|"stripe"}`.

## Routes
- POST `/auth/register` `{name,email,password,role:"CLIENT"|"DEVELOPER"}` -> `{user}` plus session cookie.
- POST `/auth/login` `{email,password}` -> `{user}`; POST `/auth/logout` -> `{ok:true}`; GET `/auth/me` -> `{user}` or 401.
- POST `/auth/forgot-password` `{email}` -> generic `{ok:true}`; POST `/auth/reset-password` `{token,password}` -> `{ok:true}`.
- POST `/auth/verify-email` `{token}` -> `{ok:true}`; POST `/auth/resend-verification` -> `{ok:true}`.
- GET `/dev/mailbox` -> `{messages:[{id,to,subject,url,createdAt}]}` development only; token links use frontend `/verify-email?token=...`, `/reset-password?token=...`.
- GET `/services?search=&category=&mine=true` -> `{services}`. GET `/services/:id` -> `{service}`.
- POST `/services` and PATCH `/services/:id` `{title,description,category,priceCents,deliveryDays,published}` -> `{service}`. Service `{id,title,description,category,priceCents,deliveryDays,published,seller:{id,name},createdAt}`.
- POST `/orders` `{serviceId,requirements}` -> `{order}`. GET `/orders` -> `{orders}`; GET `/orders/:id` -> `{order}`.
- Order `{id,title,requirements,totalCents,feeCents,sellerCents,currency,status,paymentStatus,transferStatus,paymentMode,buyer:{id,name},seller:{id,name},deliveryMessage,deliveryUrl,revisionNote,createdAt,updatedAt,events:[{id,action,message,createdAt}]}`. status `AWAITING_PAYMENT|PAID|IN_PROGRESS|DELIVERED|COMPLETED|CANCELLED`; paymentStatus `UNPAID|PENDING|PAID|FAILED|REFUND_PENDING|REFUNDED|DISPUTED`; transferStatus `NOT_RELEASED|PENDING|TRANSFERRED|FAILED`.
- POST `/orders/:id/checkout` -> `{url}` (Stripe) or `{demo:true,orderId}`.
- POST `/orders/:id/demo-pay` `{outcome:"success"|"failure"}` -> `{order}`.
- POST `/orders/:id/start` -> `{order}`.
- POST `/orders/:id/deliver` `{message,url?}` -> `{order}`.
- POST `/orders/:id/revise` `{message}` -> `{order}`.
- POST `/orders/:id/release` -> `{order}`; repeat safely returns existing completed order or retries failed transfer.
- POST `/orders/:id/cancel` `{reason}` -> `{order}` for unpaid cancellation.
- POST `/orders/:id/refund` `{reason}` -> `{order}`.
- GET `/connect/status` -> `{accountId,ready,mode}`; POST `/connect/onboard` -> `{url?,demo?,ready?}`; POST `/connect/refresh` -> `{accountId,ready,mode}`.
- GET `/dashboard` -> `{stats:{spentCents,earnedCents,activeOrders,completedOrders},orders}` scoped to actor; GET `/admin/overview` -> `{stats:{users,orders,volumeCents,feesCents},orders}`.
- POST `/webhooks/stripe` raw signed body -> `{received:true}`. Accept platform and configured Connect signing secrets.

## Payment provider interface (owned by payment implementer)
File `apps/api/src/payments/gateway.ts` exports interfaces, classes/factory. No database dependency.
```
type PaymentMode = 'demo'|'stripe';
interface CheckoutInput {orderId:string; title:string; totalCents:number; currency:string; buyerEmail:string; successUrl:string; cancelUrl:string; attempt:number}
interface CheckoutResult {id:string; url:string|null}
interface TransferInput {orderId:string; amountCents:number; currency:string; accountId:string; chargeId:string}
interface RefundInput {orderId:string; paymentIntentId:string; amountCents:number}
interface AccountResult {id:string; ready:boolean}
interface PaymentEvent {id:string; type:'paid'|'failed'|'refunded'|'refund_pending'|'disputed'|'account_updated'|'ignored'; orderId?:string; amountCents?:number; currency?:string; checkoutId?:string; paymentIntentId?:string; chargeId?:string; accountId?:string; ready?:boolean}
interface PaymentGateway {
 readonly mode:PaymentMode;
 createCheckout(input:CheckoutInput):Promise<CheckoutResult>;
 createAccount(input:{userId:string;email:string;name:string}):Promise<AccountResult>;
 createOnboardingLink(input:{accountId:string;returnUrl:string;refreshUrl:string}):Promise<{url:string}>;
 getAccount(accountId:string):Promise<AccountResult>;
 transfer(input:TransferInput):Promise<{id:string}>;
 refund(input:RefundInput):Promise<{id:string;status:'succeeded'|'pending'|'failed'}>;
 parseWebhook(body:Buffer,signature:string):Promise<PaymentEvent>;
}
function createPaymentGateway(env:Record<string,string|undefined>):PaymentGateway;
```
Stable idempotency keys: `account:{userId}`, `checkout:{orderId}:{attempt}`, `transfer:{orderId}`, `refund:{orderId}`. Platform charge metadata contains `orderId`, transfer_group is `order:{orderId}`. Checkout card-only for this version. Source charge must match paid order. SDK injectable for adapter tests. No plaintext keys in logging. Demo gateway must reject construction in production. Stripe gateway accepts only `sk_test_` for this learning build.

## Package ownership
Root coordinator: root scripts/configuration, documentation, browser checks, integration wiring. Backend worker: apps/api except src/payments, packages/database, packages/contracts, API tests/seed. Payments worker: apps/api/src/payments including adapter unit tests. Frontend worker: apps/web. Communicate contract changes; do not overwrite teammates' files. All API imports use ESM .js paths. API dev uses tsx; tests use Vitest. Prisma 6 with PostgreSQL. Use zod 3, Express 4, Stripe SDK current installed compatible version. Gateway tests can use Vitest.
