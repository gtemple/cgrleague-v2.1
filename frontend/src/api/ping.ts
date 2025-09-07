import { http } from "./client";
export type PingResponse = { status: string };
export function getPing() {
  return http<PingResponse>("/api/ping/");
}