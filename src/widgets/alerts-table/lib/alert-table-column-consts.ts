export const ALERT_COLUMN_SIZE = {
  name: { size: 180, min: 150, max: 600 },
  lastReceived: { min: 80, max: 220 },
  description: { min: 200, max: 800 },
  assignee: { min: 100, max: 400 },
  extraPayload: { min: 200, max: 800 },
  generated: { min: 100, max: 800 },
} as const;

export const AUTOFIT_MAX_WIDTH = 800;
export const AUTOFIT_HEADER_BUFFER = 32;
export const AUTOFIT_CELL_BUFFER = 8;
