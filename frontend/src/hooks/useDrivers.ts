import { useCallback, useEffect, useState } from "react";
import { listDrivers, createDriver, type Driver } from "../api/drivers";
import { getCookie } from "../lib/csrf";

export function useDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    listDrivers()
      .then(({ drivers }) => setDrivers(drivers))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addDriver = useCallback(async (name: string, team?: string) => {
    const csrf = getCookie("csrftoken");
    const created = await createDriver({ name, team }, csrf);
    setDrivers((prev) => [created, ...prev]);
    return created;
  }, []);

  return { drivers, addDriver, error, loading, refresh };
}