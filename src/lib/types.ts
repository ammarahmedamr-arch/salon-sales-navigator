import { z } from "zod";
import {
  ATTEMPT_TYPES,
  BUSINESS_TYPES,
  CHANNELS,
  CITIES,
  CONTACT_RESULTS,
  CONTACT_STATUSES,
  FOLLOW_UP_STATES,
  NEXT_ACTIONS,
  OUTCOMES,
  PRIORITIES,
  REPLIED_OPTIONS,
  SOURCES,
} from "./constants";

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

export type City = z.infer<typeof citySchema>;
export type BusinessType = z.infer<typeof businessTypeSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type ContactStatus = z.infer<typeof contactStatusSchema>;
export type ClientOutcome = z.infer<typeof outcomeSchema>;
export type ClientSource = z.infer<typeof sourceSchema>;
export type FollowUpState = z.infer<typeof followUpStateSchema>;
export type ContactChannel = z.infer<typeof channelSchema>;
export type AttemptType = z.infer<typeof attemptTypeSchema>;
export type RepliedOption = z.infer<typeof repliedSchema>;
export type ContactResult = z.infer<typeof resultSchema>;
export type NextAction = z.infer<typeof nextActionSchema>;

export const clientSchema = z.object({
  name: z.string().trim().min(2, "اكتبي اسم الصالون"),
  city: citySchema,
  business_type: businessTypeSchema,
  contact_person: z.string().trim().default(""),
  phone: z.string().trim().min(9, "أدخلي رقمًا سعوديًا صحيحًا"),
  website_url: z.string().trim().default(""),
  source: sourceSchema,
  priority: prioritySchema,
  contact_status: contactStatusSchema,
  outcome: outcomeSchema,
  last_contact_at: z.string().nullable().default(null),
  next_follow_up_date: z.string().nullable().default(null),
  notes: z.string().default(""),
  owner: z.string().trim().default(""),
  chat_url: z.string().trim().default(""),
});

export type ClientInput = z.infer<typeof clientSchema>;

export interface Client extends ClientInput {
  id: string;
  code: string;
  created_at: string;
  updated?: string | undefined;
  follow_up_state: FollowUpState;
  attempts_count: number;
}

export interface ContactLogInput {
  client_id: string;
  contacted_at: string;
  channel: ContactChannel;
  attempt_type: AttemptType;
  replied: RepliedOption;
  result: ContactResult;
  next_follow_up_date: string | null;
  reply_summary: string;
  next_action: NextAction;
  chat_url: string;
  created_by?: string | undefined;
  update_client: boolean;
  contact_status?: ContactStatus | undefined;
  outcome?: ClientOutcome | undefined;
}

export interface ContactLog extends Omit<ContactLogInput, "update_client" | "contact_status" | "outcome"> {
  id: string;
  code: string;
  client_id: string;
  created_by: string;
  created?: string | undefined;
  // Denormalized/expanded client info for log table rendering:
  client?: Client | undefined;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agent";
}

export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ClientFilters {
  search?: string | undefined;
  city?: string | undefined;
  business_type?: string | undefined;
  priority?: string | undefined;
  contact_status?: string | undefined;
  outcome?: string | undefined;
  follow_up_state?: string | undefined;
  owner?: string | undefined;
  source?: string | undefined;
}

export interface ClientListParams {
  page?: number | undefined;
  perPage?: number | undefined;
  sortBy?: keyof Client | undefined;
  sortDirection?: "asc" | "desc" | undefined;
  filters?: ClientFilters | undefined;
  // Flat filters fallback for convenience:
  search?: string | undefined;
  city?: string | undefined;
  business_type?: string | undefined;
  priority?: string | undefined;
  contact_status?: string | undefined;
  outcome?: string | undefined;
  follow_up_state?: string | undefined;
  owner?: string | undefined;
  source?: string | undefined;
}

export interface ContactLogFilters {
  channel?: string | undefined;
  result?: string | undefined;
  replied?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  owner?: string | undefined;
  search?: string | undefined;
}

export interface ContactLogListParams {
  page?: number | undefined;
  perPage?: number | undefined;
  sortBy?: keyof ContactLog | undefined;
  sortDirection?: "asc" | "desc" | undefined;
  filters?: ContactLogFilters | undefined;
  // Flat filters fallback:
  channel?: string | undefined;
  result?: string | undefined;
  replied?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  owner?: string | undefined;
  search?: string | undefined;
}

export interface DashboardStats {
  total: number;
  contacted: number;
  replied: number;
  interested: number;
  notInterested: number;
  due: number;
  demos: number;
  subscribed: number;
  funnel: { label: string; count: number; fill: string }[];
  cities: { name: string; value: number }[];
  followUps: Client[];
}
