import { NativeBiometric } from "@capgo/capacitor-native-biometric";

const STORAGE_KEY = "world.faceIdLock";

export type AuthResult = { ok: true } | { ok: false; reason: "unavailable" | "failed" };

export function readLockEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch (error) {
    console.warn("Could not read the lock setting", error);
    return false;
  }
}

export function saveLockEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Could not save the lock setting", error);
  }
}

/** Asks for Face ID, falling back to the device passcode when Face ID fails. */
export async function authenticate(): Promise<AuthResult> {
  const { isAvailable } = await NativeBiometric.isAvailable({ useFallback: true });
  if (!isAvailable) return { ok: false, reason: "unavailable" };
  try {
    await NativeBiometric.verifyIdentity({ reason: "Unlock World", title: "Unlock World", useFallback: true });
    return { ok: true };
  } catch (error) {
    console.warn("Face ID check did not pass", error);
    return { ok: false, reason: "failed" };
  }
}
