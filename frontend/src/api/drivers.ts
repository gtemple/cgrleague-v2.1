import { fetchJson } from "./client";

export type Driver = {
  id: number;
  first_name?: string;
  last_name?: string;
  name?: string; // if you still have legacy “name”
};

export async function listDrivers() {
  // assume your endpoint returns { drivers: Driver[] } or change accordingly
  return fetchJson<{ drivers: Driver[] }>(`/api/drivers/`);
}

export async function createDriver(payload: { name: string; team?: string }) {
  return fetchJson<Driver>(`/api/drivers/`, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
}