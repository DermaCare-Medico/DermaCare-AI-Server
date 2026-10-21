import { uploadScreeningImageController } from "./controllers/screening-image.controller.js";
import { createScreeningController } from "./controllers/screening-questionnaire.controller.js";
import {
  getScreeningHistoryController,
  getScreeningHistoryItemController,
} from "./controllers/screening-history.controller.js";
import { processScreeningPredictionController } from "./controllers/screening-prediction.controller.js";

export const screeningController = {
  uploadScreeningImage: uploadScreeningImageController,
  createScreening: createScreeningController,
  getHistory: getScreeningHistoryController,
  getHistoryItem: getScreeningHistoryItemController,
  processPrediction: processScreeningPredictionController,
};