import { api } from "./client";

export const PROPERTY_KNOWLEDGE_CATEGORIES = [
  "PROPERTY",
  "ARRIVAL",
  "ACCESS",
  "WIFI",
  "PARKING",
  "AMENITIES",
  "HOUSE_RULES",
  "APPLIANCE",
  "TROUBLESHOOTING",
  "EMERGENCY",
  "LOCAL_GUIDE",
] as const;

export const PROPERTY_KNOWLEDGE_VISIBILITIES = [
  "PUBLIC",
  "CONFIRMED_GUEST",
  "DURING_STAY",
] as const;

export type PropertyKnowledgeCategory =
  (typeof PROPERTY_KNOWLEDGE_CATEGORIES)[number];

export type PropertyKnowledgeVisibility =
  (typeof PROPERTY_KNOWLEDGE_VISIBILITIES)[number];

export type PropertyKnowledgeEntry = {
  id: string;
  propertyId: string;
  category: PropertyKnowledgeCategory;
  key: string;
  titleEn: string | null;
  titleEs: string | null;
  contentEn: string | null;
  contentEs: string | null;
  visibility: PropertyKnowledgeVisibility;
  sortOrder: number;
  revision: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PropertyKnowledgeDraft = {
  category: PropertyKnowledgeCategory;
  key: string;
  titleEn: string;
  titleEs: string;
  contentEn: string;
  contentEs: string;
  visibility: PropertyKnowledgeVisibility;
  sortOrder: number;
};

type PropertyKnowledgeListResponse = {
  ok: true;
  propertyId: string;
  entries: PropertyKnowledgeEntry[];
};

type PropertyKnowledgeEntryResponse = {
  ok: true;
  entry: PropertyKnowledgeEntry;
};

type PropertyKnowledgeDeactivateResponse = {
  ok: true;
  entryId: string;
  isActive: false;
  revision: number;
};

function propertyKnowledgePath(propertyId: string) {
  return `/api/dashboard/properties/${encodeURIComponent(
    propertyId
  )}/property-knowledge`;
}

export async function listPropertyKnowledge(
  propertyId: string,
  signal?: AbortSignal
) {
  return api<PropertyKnowledgeListResponse>(
    `${propertyKnowledgePath(propertyId)}?includeInactive=true`,
    { signal }
  );
}

export async function createPropertyKnowledge(
  propertyId: string,
  draft: PropertyKnowledgeDraft
) {
  return api<PropertyKnowledgeEntryResponse>(propertyKnowledgePath(propertyId), {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export async function updatePropertyKnowledge(
  propertyId: string,
  entryId: string,
  expectedRevision: number,
  draft: PropertyKnowledgeDraft
) {
  return api<PropertyKnowledgeEntryResponse>(
    `${propertyKnowledgePath(propertyId)}/${encodeURIComponent(entryId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ ...draft, expectedRevision }),
    }
  );
}

export async function deactivatePropertyKnowledge(
  propertyId: string,
  entryId: string,
  expectedRevision: number
) {
  return api<PropertyKnowledgeDeactivateResponse>(
    `${propertyKnowledgePath(propertyId)}/${encodeURIComponent(entryId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ expectedRevision }),
    }
  );
}
