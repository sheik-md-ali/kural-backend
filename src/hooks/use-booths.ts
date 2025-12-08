import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface Booth {
  _id: string;
  boothCode: string;
  boothNumber: string | number;
  boothName: string;
  ac_id: number;
  ac_name?: string;
  totalVoters?: number;
  assignedAgents?: Array<{
    _id: string;
    name: string;
    phone?: string;
    role?: string;
  }>;
  primaryAgent?: {
    _id: string;
    name: string;
    phone?: string;
  } | null;
  isActive?: boolean;
  isFromVoterData?: boolean;
}

interface UseBoothsOptions {
  /** Auto-fetch booths when AC changes */
  autoFetch?: boolean;
  /** Initial AC to fetch booths for */
  initialAcId?: string | number;
  /** Limit number of booths to fetch */
  limit?: number;
}

interface UseBoothsReturn {
  booths: Booth[];
  loading: boolean;
  error: string | null;
  /** Fetch booths for a specific AC */
  fetchBooths: (acId: string | number) => Promise<void>;
  /** Clear the booths list */
  clearBooths: () => void;
  /** Total booths count (for pagination) */
  totalCount: number;
}

/**
 * Centralized hook for fetching and managing booths
 *
 * Usage:
 * ```tsx
 * const { booths, loading, fetchBooths } = useBooths({ autoFetch: false });
 *
 * // When AC is selected:
 * useEffect(() => {
 *   if (selectedAcId) {
 *     fetchBooths(selectedAcId);
 *   }
 * }, [selectedAcId, fetchBooths]);
 * ```
 */
export function useBooths(options: UseBoothsOptions = {}): UseBoothsReturn {
  const { autoFetch = false, initialAcId, limit = 200 } = options;

  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchBooths = useCallback(async (acId: string | number) => {
    if (!acId) {
      setBooths([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/rbac/booths?ac=${acId}&limit=${limit}`);

      // Sort booths numerically by booth number
      const sortedBooths = (response.booths || []).sort((a: Booth, b: Booth) => {
        // Extract numeric part from booth code (e.g., "BOOTH1-111" -> 1)
        const getBoothNum = (booth: Booth): number => {
          const match = booth.boothCode?.match(/BOOTH(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        };
        return getBoothNum(a) - getBoothNum(b);
      });

      setBooths(sortedBooths);
      setTotalCount(response.total || sortedBooths.length);
    } catch (err: any) {
      console.error("Failed to fetch booths:", err);
      setError(err.message || "Failed to fetch booths");
      setBooths([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const clearBooths = useCallback(() => {
    setBooths([]);
    setTotalCount(0);
    setError(null);
  }, []);

  // Auto-fetch on initial AC if provided
  useEffect(() => {
    if (autoFetch && initialAcId) {
      fetchBooths(initialAcId);
    }
  }, [autoFetch, initialAcId, fetchBooths]);

  return {
    booths,
    loading,
    error,
    fetchBooths,
    clearBooths,
    totalCount,
  };
}

/**
 * Get booth display label (booth number + name)
 */
export function getBoothLabel(booth: Booth): string {
  const boothNum = booth.boothNumber || booth.boothCode;
  return `${booth.boothName} (${boothNum})`;
}

/**
 * Get booth ID in standard format: BOOTH{number}-{AC_ID}
 */
export function formatBoothId(boothNumber: string | number, acId: string | number): string {
  const numStr = String(boothNumber).replace(/^BOOTH/i, '');
  return `BOOTH${numStr}-${acId}`;
}

export default useBooths;
