import { useLocation } from "wouter";
import Landing from "./landing";

export default function Login() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-5 z-[60] flex items-center gap-2 lg:hidden">
        <button onClick={() => navigate("/sign-up")}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 bg-background/70 backdrop-blur-sm transition-all">
          Sign up
        </button>
        <button onClick={() => navigate("/sign-in")}
          className="text-xs font-semibold text-foreground px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/40 hover:bg-primary/30 hover:border-primary/60 backdrop-blur-sm transition-all">
          Log in
        </button>
      </div>
      <Landing />
    </div>
  );
}
