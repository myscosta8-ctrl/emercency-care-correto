import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";

const connectionString = (isProduction ? process.env.SUPABASE_DATABASE_URL : undefined)
  ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const useSupabase = isProduction && !!process.env.SUPABASE_DATABASE_URL;

export const pool = new Pool({
  connectionString,
  ssl: useSupabase ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
