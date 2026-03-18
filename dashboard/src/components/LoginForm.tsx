import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Phone } from "lucide-react";

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>;
  error?: string;
}

export function LoginForm({ onLogin, error }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = username.trim().length > 0 && password.trim().length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    await onLogin(username, password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary-light" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">VoicyVoice</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-2xl p-8 space-y-5"
        >
          <div>
            <label className="block text-sm text-text-secondary mb-2 font-medium">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-text-primary text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-text-muted"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2 font-medium">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-text-primary text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-text-muted"
            />
          </div>
          {error && <p className="text-frustrated text-sm">{error}</p>}
          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-light transition-colors mt-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
