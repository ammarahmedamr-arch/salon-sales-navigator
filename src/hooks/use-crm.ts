import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ClientFilters, ClientInput, ContactLogInput } from "@/lib/types";

export const crmKeys = {
  clients: ["clients"] as const, client: (id: string) => ["clients", id] as const,
  logs: ["logs"] as const, clientLogs: (id: string) => ["logs", id] as const,
  recentLogs: ["recent-logs"] as const, stats: ["dashboard-stats"] as const, users: ["team-users"] as const,
};
export function useClients(filters: ClientFilters = {}) { return useQuery({ queryKey: [...crmKeys.clients, filters], queryFn: () => api.clients.list(filters) }); }
export function useClientLogs(id: string) { return useQuery({ queryKey: crmKeys.clientLogs(id), queryFn: () => api.contactLogs.listByClient(id), enabled: !!id }); }
export function useRecentLogs(limit = 8) { return useQuery({ queryKey: [...crmKeys.recentLogs, limit], queryFn: () => api.contactLogs.listRecent(limit) }); }
export function useAllLogs() { return useQuery({ queryKey: crmKeys.logs, queryFn: () => api.contactLogs.listAll() }); }
export function useDashboardStats() { return useQuery({ queryKey: crmKeys.stats, queryFn: () => api.dashboard.stats() }); }
export function useTeamUsers() { return useQuery({ queryKey: crmKeys.users, queryFn: api.users.list }); }
function invalidateCrm(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: crmKeys.clients }); void queryClient.invalidateQueries({ queryKey: crmKeys.logs });
  void queryClient.invalidateQueries({ queryKey: crmKeys.recentLogs }); void queryClient.invalidateQueries({ queryKey: crmKeys.stats });
}
export function useSaveClient() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (data: { id?: string; input: ClientInput }) => data.id ? api.clients.update(data.id, data.input) : api.clients.create(data.input), onSuccess: () => invalidateCrm(queryClient) });
}
export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.clients.delete, onSuccess: () => invalidateCrm(queryClient) });
}
export function useSaveContactLog() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.contactLogs.create, onSuccess: (_log, input) => { invalidateCrm(queryClient); void queryClient.invalidateQueries({ queryKey: crmKeys.clientLogs(input.client_id) }); } });
}
