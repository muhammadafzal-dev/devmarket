import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
export const env = process.env;
// Same-origin deploys (frontend + API on one domain) need the trusted-Origin check
// and CORS to match the deployed URL. Prefer WEB_URL; on Vercel fall back to the
// project's production URL; otherwise the local dev origin.
export const webUrl =
  env.WEB_URL ||
  (env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:5173");
