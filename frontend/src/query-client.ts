import { QueryClient } from "@tanstack/react-query";

// The backend runs in the page, so requests never touch the network. The
// default networkMode "online" pauses every query and mutation while the
// phone reports no connection (e.g. airplane mode).
export function createQueryClient(): QueryClient {
  const networkMode = "always";
  return new QueryClient({
    defaultOptions: { queries: { networkMode }, mutations: { networkMode } },
  });
}
