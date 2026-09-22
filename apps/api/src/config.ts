import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
export const env = process.env;
export const webUrl = env.WEB_URL || "http://localhost:5173";
