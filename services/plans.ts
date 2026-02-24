import { api } from './api';
import { DiningPlan } from '../types';

export interface CreatePlanInput {
  type?: 'planned' | 'group-swipe';
  title: string;
  date?: string;
  time?: string;
  cuisine: string;
  budget: string;
  status?: string;
  inviteeIds?: string[];
  rsvpDeadline?: string;
  options?: string[];
}

export async function getPlans(): Promise<DiningPlan[]> {
  return api.get<DiningPlan[]>('/plans');
}

export async function getPlan(id: string): Promise<DiningPlan> {
  return api.get<DiningPlan>(`/plans/${id}`);
}

export async function createPlan(input: CreatePlanInput): Promise<DiningPlan> {
  return api.post<DiningPlan>('/plans', input);
}

export async function updatePlan(id: string, input: Partial<CreatePlanInput>): Promise<DiningPlan> {
  return api.put<DiningPlan>(`/plans/${id}`, input);
}

export async function rsvpPlan(
  planId: string,
  action: 'accept' | 'decline'
): Promise<void> {
  await api.post(`/plans/${planId}/rsvp`, { action });
}
