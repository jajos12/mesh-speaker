import { useCallback, useEffect, useRef } from "react";
import { useGlobalStore } from "@/store/global";
import { SYNC_CONSTANTS } from "@beatsync/shared";
import { ClientActionEnum } from "@beatsync/shared";
import { sendWSRequest } from "@/utils/ws";

interface UseSyncMonitorProps {
    onDriftDetected?: (driftMs: number) => void;
}

/**
 * Hook to monitor sync quality during playback.
 * Periodically compares actual audio position with expected server-calculated position.
 * Triggers automatic resync when drift exceeds threshold.
 */
export const useSyncMonitor = ({ onDriftDetected }: UseSyncMonitorProps = {}) => {
    const driftCheckIntervalRef = useRef<number | null>(null);
    const consecutiveDriftCountRef = useRef<number>(0);

    const isPlaying = useGlobalStore((state) => state.isPlaying);
    const isSynced = useGlobalStore((state) => state.isSynced);
    const socket = useGlobalStore((state) => state.socket);
    const offsetEstimate = useGlobalStore((state) => state.offsetEstimate);
    const getCurrentTrackPosition = useGlobalStore((state) => state.getCurrentTrackPosition);
    const playbackStartTime = useGlobalStore((state) => state.playbackStartTime);
    const playbackOffset = useGlobalStore((state) => state.playbackOffset);

    /**
     * Calculate expected position based on server time
     */
    const getExpectedPosition = useCallback(() => {
        if (!playbackStartTime) return null;

        // Current server time estimate = local time + clock offset
        const estimatedServerTime = Date.now() + offsetEstimate;

        // Time elapsed since playback started on server
        const serverElapsedMs = estimatedServerTime - playbackStartTime;

        // Expected position = starting offset + elapsed time
        return playbackOffset + (serverElapsedMs / 1000);
    }, [playbackStartTime, playbackOffset, offsetEstimate]);

    /**
     * Check for drift and trigger resync if needed
     */
    const checkDrift = useCallback(() => {
        if (!isPlaying || !isSynced || !socket) return;

        const actualPosition = getCurrentTrackPosition();
        const expectedPosition = getExpectedPosition();

        if (expectedPosition === null) return;

        const driftMs = Math.abs((actualPosition - expectedPosition) * 1000);

        // Log drift for debugging
        if (driftMs > 50) {
            console.log(`🔄 Drift detected: ${driftMs.toFixed(0)}ms (actual: ${actualPosition.toFixed(2)}s, expected: ${expectedPosition.toFixed(2)}s)`);
        }

        // Check if drift exceeds threshold
        if (driftMs > SYNC_CONSTANTS.MAX_ACCEPTABLE_DRIFT_MS) {
            consecutiveDriftCountRef.current++;
            onDriftDetected?.(driftMs);

            // Only resync if we've had consecutive drift detections (avoid false positives)
            if (consecutiveDriftCountRef.current >= 2) {
                console.warn(`⚠️ Drift exceeded threshold (${driftMs.toFixed(0)}ms > ${SYNC_CONSTANTS.MAX_ACCEPTABLE_DRIFT_MS}ms). Auto-resyncing...`);

                // Request resync from server
                sendWSRequest({
                    ws: socket,
                    request: { type: ClientActionEnum.enum.SYNC },
                });

                // Reset counter after requesting resync
                consecutiveDriftCountRef.current = 0;
            }
        } else {
            // No significant drift, reset counter
            consecutiveDriftCountRef.current = 0;
        }
    }, [isPlaying, isSynced, socket, getCurrentTrackPosition, getExpectedPosition, onDriftDetected]);

    /**
     * Start drift monitoring when playback starts
     */
    const startDriftMonitoring = useCallback(() => {
        if (driftCheckIntervalRef.current) return; // Already running

        console.log("🔍 Starting drift monitoring");
        driftCheckIntervalRef.current = window.setInterval(
            checkDrift,
            SYNC_CONSTANTS.DRIFT_CHECK_INTERVAL_MS
        );
    }, [checkDrift]);

    /**
     * Stop drift monitoring
     */
    const stopDriftMonitoring = useCallback(() => {
        if (driftCheckIntervalRef.current) {
            console.log("🛑 Stopping drift monitoring");
            clearInterval(driftCheckIntervalRef.current);
            driftCheckIntervalRef.current = null;
        }
        consecutiveDriftCountRef.current = 0;
    }, []);

    // Auto-start/stop based on playback state
    useEffect(() => {
        if (isPlaying && isSynced) {
            startDriftMonitoring();
        } else {
            stopDriftMonitoring();
        }

        return () => stopDriftMonitoring();
    }, [isPlaying, isSynced, startDriftMonitoring, stopDriftMonitoring]);

    return {
        startDriftMonitoring,
        stopDriftMonitoring,
        checkDrift,
    };
};
