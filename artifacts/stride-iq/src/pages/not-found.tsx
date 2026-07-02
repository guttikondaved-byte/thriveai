import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 bg-card border-border shadow-md">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-3 items-center">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">404 Page Not Found</h1>
          </div>

          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
