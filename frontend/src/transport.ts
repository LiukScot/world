export type Transport = (path: string, init?: RequestInit) => Promise<Response>;

let transport: Transport = (path, init) => fetch(path, init);

/** Replaces how API requests are answered; the device build routes them to the in-app backend. */
export function setTransport(next: Transport): void {
  transport = next;
}

/** Sends an API request. Every call to the backend goes through here. */
export const apiRequest: Transport = (path, init) => transport(path, init);
