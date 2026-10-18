
import express from "express";
import { env } from "./config/env.js";
import { security } from "./middlewares/security.js";
import { httpLogger } from "./shared/logger/httpLogger.js";
import { errorHandler } from "./shared/errors/errorHandler.js";
import { notFound } from "./shared/errors/notFound.js";
import apiRouter from "./routes/index.js";
import docsRouter from "./docs/docs.routes.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);

app.use(security);
app.use(httpLogger);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Actual backend routes
app.use("/api/v1", apiRouter);

// Documentation-only endpoints
app.use(docsRouter);

// Keep these last
app.use(notFound);
app.use(errorHandler);

export default app;
