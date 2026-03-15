/**
 * Web-only call detection stub.
 * Always returns null — no native call detection on web.
 */
export interface CallDetectionPlugin {
  getLastCallNumber(): Promise<{ number: string | null }>;
  clearLastCallNumber(): Promise<void>;
}

const CallDetection: CallDetectionPlugin = {
  getLastCallNumber: async () => ({ number: null }),
  clearLastCallNumber: async () => {},
};

export default CallDetection;
