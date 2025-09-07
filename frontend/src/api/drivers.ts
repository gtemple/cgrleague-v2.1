import { http } from "./client";

export type Driver = { id: number; name: string; team: string; created_at: string };

export function listDrivers() {
  return http<{ drivers: Driver[] }>("/api/drivers/");
}

export function createDriver(payload: { name: string; team?: string }, csrf?: string) {
  return http<Driver>("/api/drivers/", {
    method: "POST",
    headers: csrf ? { "X-CSRFToken": csrf } : undefined,
    json: payload,
  });
}