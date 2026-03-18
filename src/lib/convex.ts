import { ConvexClient } from "convex/browser";

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error("CONVEX_URL environment variable is required");
}

export const convex = new ConvexClient(CONVEX_URL);
