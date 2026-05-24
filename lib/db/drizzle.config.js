import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

export default {
  schema: "./src/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
