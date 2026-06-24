import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Render Postgres external connections require SSL. drizzle-kit v0.31 ignores
// the `ssl` config field when `url` is set, so we force it via sslmode in the
// URL. Self-signed cert is fine for Render — server identity is trusted via
// the unguessable host suffix.
const url = process.env.DATABASE_URL.includes("sslmode=")
  ? process.env.DATABASE_URL
  : `${process.env.DATABASE_URL}${process.env.DATABASE_URL.includes("?") ? "&" : "?"}sslmode=require`;

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: { url },
});
