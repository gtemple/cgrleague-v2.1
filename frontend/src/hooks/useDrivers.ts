// src/hooks/useDrivers.ts
import { useCallback } from "react";
import { useApiQuery } from "./useApiQuery";
import { useApiMutation } from "./useApiMutation";
import { type Driver } from "../api/drivers";

export function useDrivers() {
  // Query drivers
  const { data, isLoading, error, refetch } = useApiQuery<{ drivers: Driver[] }>(`/api/drivers/`);

  // Mutation to add driver
  const { mutate: add, isLoading: adding, error: addError } = useApiMutation<Driver, { name: string; team?: string }>(
    `/api/drivers/`,
    { method: "POST" }
  );

  const addDriver = useCallback(
    async (name: string, team?: string) => {
      const created = await add({ name, team });
      // simple optimistic update: re-fetch list after create
      refetch();
      return created;
    },
    [add, refetch]
  );

  return {
    drivers: data?.drivers ?? [],
    loading: isLoading || adding,
    error: error || addError,
    refresh: refetch,
    addDriver,
  };
}
