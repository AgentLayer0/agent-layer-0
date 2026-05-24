import { ReactNode, useCallback, useState } from "react";
import { Sidebar } from "./Sidebar";
import { useQueryClient } from "@tanstack/react-query";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [queryClient]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar onRefresh={handleRefresh} isRefreshing={isRefreshing} />
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="absolute top-4 right-8 text-xs text-muted-foreground font-mono">
          Refreshing every 30s
        </div>
        {children}
      </main>
    </div>
  );
}
