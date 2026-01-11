import { defineConfig } from "drizzle-kit";

// const connectionString = process.env.DATABASE_URL;
// if (!connectionString) {
//   throw new Error("DATABASE_URL is required to run drizzle commands");
// }
const connectionString="mysql://root:@192.168.1.142:4000/wukong_dev"
export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
