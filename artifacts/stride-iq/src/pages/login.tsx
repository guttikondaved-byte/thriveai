import { useAuth } from "@workspace/replit-auth-web";
import { Zap } from "lucide-react";

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Zap className="w-7 h-7 text-primary" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Thrive</h1>
        <p className="text-muted-foreground text-sm mb-10">
          AI-powered training for serious athletes
        </p>

        <button
          onClick={login}
          className="w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          Log in to continue
        </button>

        <p className="mt-6 text-xs text-muted-foreground">
          Don't have an account? Logging in will create one automatically.
        </p>
      </div>
    </div>
  );
}
