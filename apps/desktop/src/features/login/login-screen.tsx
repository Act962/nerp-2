import { type FormEvent, useState } from "react";
import { client } from "../../lib/client";
import { detectPlatform } from "../../lib/platform";
import { persistSession, type StoredSession } from "../../lib/token-store";

// Tela de pareamento (o "login" do terminal). Autentica por credenciais via
// `device.pairWithCredentials`, guarda o token e entra no PDV. Sem cookie.
export function LoginScreen({
  onPaired,
}: {
  onPaired: (session: StoredSession) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deviceName, setDeviceName] = useState("Caixa 01");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await client.device.pairWithCredentials({
        email,
        password,
        name: deviceName,
        platform: detectPlatform(),
      });
      const session: StoredSession = {
        token: result.token,
        organizationId: result.organizationId,
        organizationName: result.organizationName,
        operatorName: result.operatorName,
        registerName: deviceName,
      };
      await persistSession(session);
      onPaired(session);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao parear o terminal",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen center">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="login-mark">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h1 className="brand">NERP Caixa</h1>
        <p className="muted">Parear este terminal</p>

        <label className="field">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            required
          />
        </label>

        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        <label className="field">
          <span>Nome do terminal</span>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? "Pareando…" : "Parear e entrar"}
        </button>
      </form>
    </div>
  );
}
