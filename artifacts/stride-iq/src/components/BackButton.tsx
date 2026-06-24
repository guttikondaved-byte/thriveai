import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ href = "./" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
      data-testid="link-back"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Back
    </Link>
  );
}
