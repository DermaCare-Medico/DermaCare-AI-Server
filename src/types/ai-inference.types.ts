export interface ModelConfig {
  id2label: Record<string, string>;
}

export interface PreprocessorConfig {
  do_resize: boolean;
  do_rescale: boolean;
  do_normalize: boolean;
  resample: number;
  rescale_factor: number;
  image_mean: number[];
  image_std: number[];
  size: {
    width: number;
    height: number;
  };
}

export interface PredictionResult {
  classId: number;
  className: string;
  score: number;
}