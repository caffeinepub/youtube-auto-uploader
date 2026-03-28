import type {
  OAuthConfig,
  QueueItem,
  SchedulerState,
  UploadHistoryEntry,
} from "@/backend.d";
import { useActor } from "@/hooks/useActor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useQueue() {
  const { actor, isFetching } = useActor();
  return useQuery<QueueItem[]>({
    queryKey: ["queue"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getQueue();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10000,
  });
}

export function useUploadHistory() {
  const { actor, isFetching } = useActor();
  return useQuery<UploadHistoryEntry[]>({
    queryKey: ["uploadHistory"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getUploadHistory();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 15000,
  });
}

export function useSchedulerState() {
  const { actor, isFetching } = useActor();
  return useQuery<SchedulerState | null>({
    queryKey: ["schedulerState"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getSchedulerState();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30000,
  });
}

export function useAddToQueue() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: QueueItem) => {
      if (!actor) throw new Error("Not connected");
      return actor.addToQueue(item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}

export function useRemoveFromQueue() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (driveFileId: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.removeFromQueue(driveFileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}

export function useClearQueue() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.clearQueue();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}

export function useSetOAuthConfig() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: OAuthConfig) => {
      if (!actor) throw new Error("Not connected");
      return actor.setOAuthConfig(config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oauthConfig"] });
    },
  });
}

export function useRecordUpload() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: UploadHistoryEntry) => {
      if (!actor) throw new Error("Not connected");
      return actor.recordUpload(entry);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploadHistory"] });
    },
  });
}
