import { useState } from "react";
import { LoginScreen } from "./features/login/login-screen";
import { PdvScreen } from "./features/pdv/pdv-screen";
import {
  clearStoredSession,
  getStoredSession,
  type StoredSession,
} from "./lib/token-store";

export function App() {
  const [session, setSession] = useState<StoredSession | null>(() =>
    getStoredSession(),
  );

  if (!session) {
    return <LoginScreen onPaired={setSession} />;
  }

  return (
    <PdvScreen
      session={session}
      onLogout={() => {
        clearStoredSession();
        setSession(null);
      }}
    />
  );
}
