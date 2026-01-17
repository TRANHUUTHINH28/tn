
export interface TrialData {
  id: number;
  current: number; // I (A)
  f1: number;      // F1 (N)
  f2: number;      // F2 (N)
  force: number;   // F = F2 - F1 (N)
  bValue: number;  // B = F / (NIL) (T)
}

export interface Config {
  turns: number;    // N (vòng)
  length: number;   // L (m)
  kFactor: number;  // Hệ số nam châm điện
  noise: number;    // Sai số (%)
}
