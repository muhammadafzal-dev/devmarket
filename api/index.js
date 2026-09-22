// Vercel serverless function entry. Re-exports the compiled Express app so Vercel
// bundles plain JS (no cross-workspace TypeScript resolution). `yarn build` must
// run first (vercel.json buildCommand) to produce apps/api/dist/serverless.js.
export { default } from "../apps/api/dist/serverless.js";
