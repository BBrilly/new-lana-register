import { ReactNode, useEffect, useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Wallet, LayoutDashboard, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { logout, isAuthenticated, getAuthSession } from "@/utils/wifAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const authenticated = isAuthenticated();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!authenticated) {
        setIsAdmin(false);
        return;
      }

      const session = getAuthSession();
      if (!session?.nostrHexId) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('nostr_hex_id')
        .eq('nostr_hex_id', session.nostrHexId)
        .maybeSingle();

      setIsAdmin(!error && !!data);
    };

    checkAdminStatus();
  }, [authenticated]);

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out",
    });
    navigate("/login");
  };
  return <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">L</span>
              </div>
              <span className="text-xl font-semibold text-foreground">Decentralised Lana Register</span>
            </div>
            <div className="flex gap-1">
              <NavLink to="/" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" activeClassName="bg-secondary text-foreground">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
              <NavLink to="/wallets" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" activeClassName="bg-secondary text-foreground">
                <Wallet className="h-4 w-4" />
                Wallets
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-700" activeClassName="bg-red-700 text-white">
                  <Shield className="h-4 w-4" />
                  Admin
                </NavLink>
              )}
              {authenticated && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>;
};
export default Layout;