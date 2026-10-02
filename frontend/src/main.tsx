import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { RootErrorBoundary } from "./app/ErrorBoundary";
import { getErrorMessage } from "./lib";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "./styles.css";

document.body.classList.add("mh-app");

if (import.meta.env.MODE === "device") {
  try {
    const { startLocalBackend } = await import("./local-backend");
    await startLocalBackend();
  } catch (error) {
    // A phone has no console to read: without this the app is a blank screen.
    document.body.textContent = `World could not open its database: ${getErrorMessage(error)}`;
    throw error;
  }
}

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </QueryClientProvider>
  </StrictMode>
);
