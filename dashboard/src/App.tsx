import { ConvexProvider } from "convex/react";
import { convex } from "./lib/convex";
import { useState } from "react";
import { Phone, BarChart3, LogOut, Menu } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { LoginForm } from "./components/LoginForm";
import { LiveCalls } from "./pages/LiveCalls";
import { Analytics } from "./pages/Analytics";

type Page = "live" | "analytics";

export default function App() {
  const { authed, login, logout, error } = useAuth();
  const [page, setPage] = useState<Page>("live");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!authed) {
    return <LoginForm onLogin={login} error={error} />;
  }

  const navigate = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
  };

  return (
    <ConvexProvider client={convex}>
      <div className="flex h-screen">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <nav
          className={`fixed lg:static inset-y-0 left-0 z-50 w-56 bg-bg lg:bg-surface/60 border-r border-border flex flex-col px-3 py-6 transition-transform lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3 px-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <Phone className="w-4 h-4 text-primary-light" />
            </div>
            <span className="text-sm font-semibold tracking-tight">VoicyVoice</span>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => navigate("live")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                page === "live"
                  ? "bg-primary/15 text-primary-light"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-hover"
              }`}
            >
              <Phone className="w-4 h-4" />
              Live Calls
            </button>

            <button
              onClick={() => navigate("analytics")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                page === "analytics"
                  ? "bg-primary/15 text-primary-light"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-hover"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </button>
          </div>

          <div className="mt-auto">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-muted hover:text-frustrated hover:bg-surface-hover transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </nav>

        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          <header className="h-14 lg:h-16 border-b border-border flex items-center px-4 lg:px-8 gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-surface-hover transition-colors"
            >
              <Menu className="w-5 h-5 text-text-secondary" />
            </button>
            <h1 className="text-base font-semibold tracking-tight">
              {page === "live" ? "Live Calls" : "Analytics"}
            </h1>
          </header>
          {page === "live" ? <LiveCalls /> : <Analytics />}
        </main>
      </div>
    </ConvexProvider>
  );
}
