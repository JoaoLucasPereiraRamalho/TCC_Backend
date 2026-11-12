/** Envelopes de resposta (Especificação da API, seção 2). */
export interface DataEnvelope<T> {
  data: T;
}

export interface PageInfo {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PageEnvelope<T> {
  data: T[];
  page: PageInfo;
}

export function ok<T>(data: T): DataEnvelope<T> {
  return { data };
}

export function paged<T>(items: T[], page: PageInfo): PageEnvelope<T> {
  return { data: items, page };
}
