import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { RootErrorBoundary } from "./app/ErrorBoundary";
import { getErrorMessage } from "./lib";
import { createQueryClient } from "./query-client";
import { startLocalBackend } from "./local-backend";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "./styles.css";

document.body.classList.add("mh-app");

try {
  await startLocalBackend();
} catch (error) {
  // A phone has no console to read: without this the app is a blank screen.
  document.body.textContent = `World could not open its database: ${getErrorMessage(error)}`;
  throw error;
}

const queryClient = createQueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </QueryClientProvider>
  </StrictMode>
);
