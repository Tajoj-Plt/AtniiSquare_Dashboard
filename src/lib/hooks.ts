import * as React from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, ApiError, type Page } from '@/lib/api';

export interface ListState {
  q: string;
  sort: string;
  /** `filter[field]=value` pairs — the API's allow-listed column filters. */
  filter: Record<string, string>;
  /**
   * Top-level query parameters an endpoint accepts outside the filter map — `role`,
   * `activity`, `created_from` and so on. They are a separate channel because they are not
   * column equality checks; the API applies each with its own predicate.
   */
  extra: Record<string, string>;
  limit: number;
}

/**
 * Drives a DataTable against a cursor-paginated endpoint.
 *
 * Cursor pages are accumulated in local state rather than replaced, so "load more" appends
 * while any change to the search, sort or filters resets the accumulation — which is the
 * behaviour a keyset-paginated list needs to stay coherent.
 */
export function useListQuery<T extends { id: string }>(
  key: string,
  path: string,
  initial: Partial<ListState> = {},
) {
  const [state, setState] = React.useState<ListState>({
    q: '', sort: '', filter: {}, extra: {}, limit: 25, ...initial,
  });
  const [pages, setPages] = React.useState<T[]>([]);
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);

  const params = {
    limit: state.limit,
    cursor,
    q: state.q || undefined,
    sort: state.sort || undefined,
    filter: state.filter,
    ...state.extra,
  };

  const query = useQuery({
    queryKey: [key, params],
    queryFn: () => api.get<Page<T>>(path, params),
    placeholderData: keepPreviousData,
  });

  // Accumulate when paging forward; replace when the query itself changed.
  React.useEffect(() => {
    if (!query.data) return;
    setPages((prev) => (cursor ? [...prev, ...query.data.data] : query.data.data));
  }, [query.data, cursor]);

  const update = React.useCallback((patch: Partial<ListState>) => {
    setCursor(undefined);
    setPages([]);
    setState((s) => ({ ...s, ...patch, filter: { ...s.filter, ...(patch.filter ?? {}) } }));
  }, []);

  const setFilter = React.useCallback((key: string, value: string | undefined) => {
    setCursor(undefined);
    setPages([]);
    setState((s) => {
      const filter = { ...s.filter };
      if (!value || value === 'all') delete filter[key];
      else filter[key] = value;
      return { ...s, filter };
    });
  }, []);

  /** Same contract as setFilter, for the top-level parameters. */
  const setExtra = React.useCallback((key: string, value: string | undefined) => {
    setCursor(undefined);
    setPages([]);
    setState((s) => {
      const extra = { ...s.extra };
      if (!value || value === 'all') delete extra[key];
      else extra[key] = value;
      return { ...s, extra };
    });
  }, []);

  const reset = React.useCallback(() => {
    setCursor(undefined);
    setPages([]);
    setState({ q: '', sort: '', filter: {}, extra: {}, limit: initial.limit ?? 25 });
  }, [initial.limit]);

  const refresh = React.useCallback(() => {
    setCursor(undefined);
    setPages([]);
    void query.refetch();
  }, [query]);

  return {
    rows: pages,
    total: query.data?.total,
    hasMore: Boolean(query.data?.nextCursor),
    loadMore: () => setCursor(query.data?.nextCursor ?? undefined),
    loading: query.isLoading,
    loadingMore: query.isFetching && Boolean(cursor),
    error: (query.error as Error) ?? null,
    state,
    setSearch: (q: string) => update({ q }),
    setSort: (sort: string) => update({ sort }),
    setFilter,
    setExtra,
    reset,
    refresh,
  };
}

/** Mutation wrapper that surfaces the API's error envelope as a toast. */
export function useApiMutation<TData = any, TVars = any>(
  fn: (vars: TVars) => Promise<TData>,
  options: {
    successMessage?: string;
    invalidate?: string[][];
    onSuccess?: (data: TData, vars: TVars) => void;
  } = {},
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      if (options.successMessage) toast.success(options.successMessage);
      options.invalidate?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      options.onSuccess?.(data, vars);
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        toast.error(error.errors[0]?.message ?? t('common.error'), {
          description: error.errors.length > 1
            ? error.errors.slice(1).map((e) => e.message).join(' · ')
            : error.requestId && `Request ${error.requestId}`,
        });
      } else {
        toast.error(t('common.error'), { description: (error as Error)?.message });
      }
    },
  });
}

/** Local form state with server-side field errors merged in. */
export function useForm<T extends Record<string, any>>(initial: T) {
  const [values, setValues] = React.useState<T>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const set = React.useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }, []);

  const applyApiError = React.useCallback((error: unknown) => {
    if (error instanceof ApiError) setErrors(error.fieldErrors);
  }, []);

  return { values, setValues, set, errors, setErrors, applyApiError, reset: () => { setValues(initial); setErrors({}); } };
}
