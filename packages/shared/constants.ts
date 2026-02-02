export const R2_AUDIO_FILE_NAME_DELIMITER = "___";

const STEADY_STATE_INTERVAL_MS = 2500;

// NTP Heartbeat Constants
export const NTP_CONSTANTS = {
  // Initial interval for rapid measurement collection
  INITIAL_INTERVAL_MS: 30,
  // Steady state interval after initial measurements
  STEADY_STATE_INTERVAL_MS: STEADY_STATE_INTERVAL_MS,
  // Timeout before considering connection stale
  RESPONSE_TIMEOUT_MS: 1.5 * STEADY_STATE_INTERVAL_MS,
  // Maximum number of NTP measurements to collect initially
  MAX_MEASUREMENTS: 40,
} as const;

export const CHAT_CONSTANTS = {
  MAX_MESSAGE_LENGTH: 20_000,
} as const;

// Sync Enhancement Constants
export const SYNC_CONSTANTS = {
  // How often to check for drift during playback (ms)
  DRIFT_CHECK_INTERVAL_MS: 10_000,
  // Maximum acceptable drift before triggering auto-resync (ms)
  MAX_ACCEPTABLE_DRIFT_MS: 100,
  // RTT spike threshold - if current RTT > average * this, network is degraded
  RTT_SPIKE_THRESHOLD: 2.0,
  // Maximum retry attempts for late scheduling before showing error
  MAX_RESYNC_RETRIES: 3,
  // Base delay for exponential backoff retry (ms)
  RETRY_BASE_DELAY_MS: 500,
} as const;
