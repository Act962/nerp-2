import { useEffect, useState } from "react";
import { LoginScreen } from "./features/login/login-screen";
import { PdvScreen } from "./features/pdv/pdv-screen";
import {
  clearSession,
  loadSession,
  type StoredSession,
} from "./lib/token-store";

export function App() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void loadSession().then((s) => {
      setSession(s);
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return (
      <div className="screen center">
        <p className="muted">Carregando…</p>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onPaired={setSession} />;
  }

  return (
    <PdvScreen
      session={session}
      onLogout={() => {
        void clearSession();
        setSession(null);
      }}
    />
  );
}
