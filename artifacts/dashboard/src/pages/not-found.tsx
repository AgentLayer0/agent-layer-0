import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 bg-card border-card-border">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-3 items-center">
            <AlertCircle className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold font-mono text-foreground">
              404 NOT FOUND
            </h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground font-mono">
            The requested page does not exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
