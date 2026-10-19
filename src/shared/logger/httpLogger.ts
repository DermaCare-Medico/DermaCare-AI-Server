import {pinoHttp} from "pino-http";
import { logger } from "./logger.js";

export const httpLogger = pinoHttp({
  logger,

  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url?.split("?")[0],
      };
    },

    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});