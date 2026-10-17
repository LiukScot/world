import { QueryClient } from "@tanstack/react-query";

// The backend runs in the page, so requests never touch the network. The
// default networkMode "online" pauses every query and mutation while the
// phone reports no connection (e.g. airplane mode).
//
// Nothing else writes the data, so a fetched result stays true until a
// mutation of ours invalidates it. Keeping it forever (staleTime, gcTime)
// makes a page you have already seen open from the cache instead of
// querying again. This holds only while each mutation invalidates every
// query key that reads what it changed: queries sharing a prefix with the
// mutation's key are covered, a differently named key is not.
export function createQueryClient(): QueryClient {
  const networkMode = "always";
  return new QueryClient({
    defaultOptions: {
      queries: { networkMode, staleTime: Infinity, gcTime: Infinity },
      mutations: { networkMode },
    },
  });
}
