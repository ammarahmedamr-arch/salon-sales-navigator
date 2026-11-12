import { z } from "zod";
import { ATTEMPT_TYPES, BUSINESS_TYPES, CHANNELS, CITIES, CONTACT_RESULTS, CONTACT_STATUSES, FOLLOW_UP_STATES, NEXT_ACTIONS, OUTCOMES, PRIORITIES, REPLIED_OPTIONS, SOURCES } from "./constants";

export const citySchema = z.enum(CITIES);
export const businessTypeSchema = z.enum(BUSINESS_TYPES);
export const prioritySchema = z.enum(PRIORITIES);
export const contactStatusSchema = z.enum(CONTACT_STATUSES);
export const outcomeSchema = z.enum(OUTCOMES);
export const sourceSchema = z.enum(SOURCES);
export const followUpStateSchema = z.enum(FOLLOW_UP_STATES).or(z.literal(""));
export const channelSchema = z.enum(CHANNELS);
export const attemptTypeSchema = z.enum(ATTEMPT_TYPES);
export const repliedSchema = z.enum(REPLIED_OPTIONS);
export const resultSchema = z.enum(CONTACT_RESULTS);
export const nextActionSchema = z.enum(NEXT_ACTIONS);

export const clientSchema = z.object({
  name: z.string().trim().min(2, "اكتبي اسم الصالون"), city: citySchema,
  business_type: businessTypeSchema, contact_person: z.string().trim().default(""),
  phone: z.string().trim().min(9, "أدخلي رقمًا سعوديًا صحيحًا"), website_url: z.string().trim().default(""),
  source: sourceSchema, priority: prioritySchema, contact_status: contactStatusSchema, outcome: outcomeSchema,
  last_contact_at: z.string().nullable().default(null), next_follow_up_date: z.string().nullable().default(null),
  notes: z.string().default(""), owner: z.string().default("عمر الحربي"), chat_url: z.string().trim().default(""),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type FollowUpState = z.infer<typeof followUpStateSchema>;
export interface Client extends ClientInput {
  id: string; code: string; created_at: string; follow_up_state: FollowUpState; attempts_count: number;
}
export interface ContactLogInput {
  client_id: string; contacted_at: string; channel: z.infer<typeof channelSchema>;
  attempt_type: z.infer<typeof attemptTypeSchema>; replied: z.infer<typeof repliedSchema>;
  result: z.infer<typeof resultSchema>; next_follow_up_date: string | null;
  reply_summary: string; next_action: z.infer<typeof nextActionSchema>; chat_url: string;
  update_client: boolean; contact_status?: z.infer<typeof contactStatusSchema>; outcome?: z.infer<typeof outcomeSchema>;
}
export interface ContactLog extends Omit<ContactLogInput, "update_client" | "contact_status" | "outcome"> {
  id: string; code: string; client_id: string;
}
export interface AppUser { id: string; name: string; email: string }
export interface ClientFilters {
  search?: string; city?: string; business_type?: string; priority?: string; contact_status?: string;
  outcome?: string; follow_up_state?: string; owner?: string; source?: string; page?: number;
  sortBy?: keyof Client; sortDirection?: "asc" | "desc";
}
export interface DashboardStats {
  total: number; contacted: number; replied: number; interested: number; notInterested: number;
  due: number; demos: number; subscribed: number;
  funnel: { label: string; count: number; fill: string }[];
  cities: { name: string; value: number }[];
  followUps: Client[];
}
