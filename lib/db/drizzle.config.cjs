require("dotenv").config({ path: "../../.env" });

/** @type {import("drizzle-kit").Config} */
module.exports = {
  schema: "./src/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
