import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import pb from "@/lib/pb";
import type {
  ClientInput,
  ClientListParams,
  ContactLogInput,
  ContactLogListParams,
} from "@/lib/types";

export const crmKeys = {
  clients: ["clients"] as const,
  client: (id: string) => ["clients", id] as const,
  logs: ["logs"] as const,
  clientLogs: (id: string) => ["client-logs", id] as const,
  recentLogs: ["recent-logs"] as const,
  stats: ["dashboard-stats"] as const,
  users: ["team-users"] as const,
};

export function useClients(params: ClientListParams = {}) {
  return useQuery({
    queryKey: [...crmKeys.clients, params],
    queryFn: () => api.clients.list(params),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: crmKeys.client(id),
    queryFn: () => api.clients.get(id),
    enabled: !!id,
  });
}

export function useClientLogs(id: string) {
  return useQuery({
    queryKey: crmKeys.clientLogs(id),
    queryFn: () => api.contactLogs.listByClient(id),
    enabled: !!id,
  });
}

export function useRecentLogs(limit = 8) {
  return useQuery({
    queryKey: [...crmKeys.recentLogs, limit],
    queryFn: () => api.contactLogs.listRecent(limit),
  });
}

export function useLogs(params: ContactLogListParams = {}) {
  return useQuery({
    queryKey: [...crmKeys.logs, params],
    queryFn: () => api.contactLogs.list(params),
  });
}

export function useAllLogs() {
  return useQuery({
    queryKey: crmKeys.logs,
    queryFn: () => api.contactLogs.listAll(),
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: crmKeys.stats,
    queryFn: () => api.dashboard.stats(),
  });
}

export function useTeamUsers() {
  return useQuery({
    queryKey: crmKeys.users,
    queryFn: api.users.list,
  });
}

export const useUsers = useTeamUsers;

export function invalidateCrm(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ refetchType: "all" });
}

export function useCrmRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unsubClients: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;

    pb.collection("clients")
      .subscribe("*", () => {
        invalidateCrm(queryClient);
      })
      .then((unsub) => {
        unsubClients = unsub;
      })
      .catch((err) => console.warn("Realtime clients sub error:", err));

    pb.collection("contact_logs")
      .subscribe("*", () => {
        invalidateCrm(queryClient);
      })
      .then((unsub) => {
        unsubLogs = unsub;
      })
      .catch((err) => console.warn("Realtime logs sub error:", err));

    pb.collection("users")
      .subscribe("*", () => {
        invalidateCrm(queryClient);
      })
      .then((unsub) => {
        unsubUsers = unsub;
      })
      .catch((err) => console.warn("Realtime users sub error:", err));

    return () => {
      unsubClients?.();
      unsubLogs?.();
      unsubUsers?.();
    };
  }, [queryClient]);
}

export function useSaveClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id?: string; input: ClientInput }) =>
      data.id ? api.clients.update(data.id, data.input) : api.clients.create(data.input),
    onSuccess: (_client, variables) => {
      invalidateCrm(queryClient);
      if (variables.id) {
        void queryClient.invalidateQueries({ queryKey: crmKeys.client(variables.id) });
      }
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.clients.delete,
    onSuccess: () => invalidateCrm(queryClient),
  });
}

export function useSaveContactLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.contactLogs.create,
    onSuccess: (_log, input) => {
      invalidateCrm(queryClient);
      void queryClient.invalidateQueries({ queryKey: crmKeys.clientLogs(input.client_id) });
      void queryClient.invalidateQueries({ queryKey: crmKeys.client(input.client_id) });
    },
  });
}
