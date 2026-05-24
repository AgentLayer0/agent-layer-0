import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Users, Vote, ListTree, LogOut, RefreshCcw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Sidebar({ onRefresh, isRefreshing }: SidebarProps) {
  const [location] = useLocation();
  const { logout } = useAuth();

  const navItems = [
    { href: "/overview", label: "Overview", icon: Activity },
    { href: "/polls", label: "Polls", icon: Vote },
    { href: "/agents", label: "Agents", icon: Users },
    { href: "/transactions", label: "Transactions", icon: ListTree },
  ];

  return (
    <div className="flex flex-col h-full w-64 bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <div className="p-6 flex items-center justify-between">
        <div className="font-mono text-xl font-bold text-primary tracking-tight">
          [AL0]
        </div>
        {onRefresh && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onRefresh} 
            disabled={isRefreshing}
            data-testid="button-refresh"
            className="text-muted-foreground hover:text-primary"
          >
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link key={item.href} href={item.href}>
              <div 
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
