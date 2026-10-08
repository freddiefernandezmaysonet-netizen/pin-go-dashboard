import { cleanerRequest } from "./cleaner";
export type TemplateItem = { id: string; es: string; en: string; required: boolean };
export type ChecklistTemplate = { revision: number; items: TemplateItem[] };
export type TaskChecklist = { id: string; editable: boolean; legacy: boolean; items: { id: string; labelEs: string; labelEn: string; required: boolean; checked: boolean; version: number }[] };
export const getChecklistTemplate = (propertyId: string) => cleanerRequest<ChecklistTemplate>(`/api/properties/${encodeURIComponent(propertyId)}/cleaning-checklist`);
export const saveChecklistTemplate = (propertyId: string, template: ChecklistTemplate) => cleanerRequest<ChecklistTemplate>(`/api/properties/${encodeURIComponent(propertyId)}/cleaning-checklist`, { method: "PUT", body: JSON.stringify(template) });
export const getTaskChecklist = (taskId: string) => cleanerRequest<TaskChecklist>(`/api/cleaner/cleanings/${encodeURIComponent(taskId)}/checklist`);
export const setTaskChecklistItem = (taskId: string, itemId: string, checked: boolean, version: number) => cleanerRequest(`/api/cleaner/cleanings/${encodeURIComponent(taskId)}/checklist/${encodeURIComponent(itemId)}`, { method: "PATCH", body: JSON.stringify({ checked, version }) });
