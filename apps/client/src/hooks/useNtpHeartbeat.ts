import { useCallback, useEffect, useRef, useState } from "react";
import { useGlobalStore, MAX_NTP_MEASUREMENTS } from "@/store/global";
import { NTP_CONSTANTS, SYNC_CONSTANTS, ClientActionEnum } from "@beatsync/shared";
import { sendWSRequest } from "@/utils/ws";

interface UseNtpHeartbeatProps {
  onConnectionStale?: () => void;
  onNetworkDegraded?: () => void;
}

export const useNtpHeartbeat = ({
  onConnectionStale,
  onNetworkDegraded,
}: UseNtpHeartbeatProps) => {
  const ntpTimerRef = useRef<number | null>(null);
  const lastNtpRequestTime = useRef<number | null>(null);
  const rttHistoryRef = useRef<number[]>([]);
  const [isNetworkDegraded, setIsNetworkDegraded] = useState(false);

  const sendNTPRequest = useGlobalStore((state) => state.sendNTPRequest);
  const roundTripEstimate = useGlobalStore((state) => state.roundTripEstimate);
  const socket = useGlobalStore((state) => state.socket);

  /**
   * Check if network quality has degraded based on RTT spike
   */
  const checkNetworkQuality = useCallback(() => {
    const currentRTT = roundTripEstimate;
    if (currentRTT <= 0) return;

    // Add to history (keep last 10 measurements)
    rttHistoryRef.current.push(currentRTT);
    if (rttHistoryRef.current.length > 10) {
      rttHistoryRef.current.shift();
    }

    // Need at least 5 measurements to detect spikes
    if (rttHistoryRef.current.length < 5) return;

    // Calculate average RTT (excluding current)
    const historicalRTTs = rttHistoryRef.current.slice(0, -1);
    const avgRTT = historicalRTTs.reduce((a, b) => a + b, 0) / historicalRTTs.length;

    // Detect spike: current RTT > threshold * average
    const isSpike = currentRTT > avgRTT * SYNC_CONSTANTS.RTT_SPIKE_THRESHOLD;

    if (isSpike && !isNetworkDegraded) {
      console.warn(`📶 Network degradation detected: RTT ${currentRTT.toFixed(0)}ms > ${(avgRTT * SYNC_CONSTANTS.RTT_SPIKE_THRESHOLD).toFixed(0)}ms threshold`);
      setIsNetworkDegraded(true);
      onNetworkDegraded?.();

      // Request resync due to network change
      if (socket && socket.readyState === WebSocket.OPEN) {
        sendWSRequest({
          ws: socket,
          request: { type: ClientActionEnum.enum.SYNC },
        });
      }
    } else if (!isSpike && isNetworkDegraded) {
      console.log("📶 Network quality recovered");
      setIsNetworkDegraded(false);
    }
  }, [roundTripEstimate, isNetworkDegraded, onNetworkDegraded, socket]);

  // Schedule next NTP request
  const scheduleNextNtpRequest = useCallback(() => {
    // Cancel any existing timeout
    if (ntpTimerRef.current) {
      clearTimeout(ntpTimerRef.current);
    }

    // Determine interval based on whether we have initial measurements
    const currentMeasurements = useGlobalStore.getState().ntpMeasurements;
    const interval =
      currentMeasurements.length < MAX_NTP_MEASUREMENTS
        ? NTP_CONSTANTS.INITIAL_INTERVAL_MS
        : NTP_CONSTANTS.STEADY_STATE_INTERVAL_MS;

    ntpTimerRef.current = window.setTimeout(() => {
      // Check if we have a pending request that timed out BEFORE resetting timer
      if (
        lastNtpRequestTime.current &&
        Date.now() - lastNtpRequestTime.current >
        NTP_CONSTANTS.RESPONSE_TIMEOUT_MS
      ) {
        console.error("NTP request timed out - connection may be stale");
        // Notify parent component that connection is stale
        onConnectionStale?.();
        return; // Don't send another request or schedule next
      }

      // Only reset timer and send request if the previous one didn't timeout
      lastNtpRequestTime.current = Date.now();
      sendNTPRequest();
      scheduleNextNtpRequest(); // Schedule the next one
    }, interval);
  }, [sendNTPRequest, onConnectionStale]);

  // Start the heartbeat when socket opens
  const startHeartbeat = useCallback(() => {
    rttHistoryRef.current = []; // Reset RTT history
    setIsNetworkDegraded(false);
    scheduleNextNtpRequest();
  }, [scheduleNextNtpRequest]);

  // Stop the heartbeat
  const stopHeartbeat = useCallback(() => {
    if (ntpTimerRef.current) {
      clearTimeout(ntpTimerRef.current);
      ntpTimerRef.current = null;
    }
    lastNtpRequestTime.current = null;
    rttHistoryRef.current = [];
  }, []);

  // Mark that we received an NTP response and check network quality
  const markNTPResponseReceived = useCallback(() => {
    lastNtpRequestTime.current = null;
    checkNetworkQuality();
  }, [checkNetworkQuality]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  return {
    startHeartbeat,
    stopHeartbeat,
    markNTPResponseReceived,
    isNetworkDegraded,
  };
};
