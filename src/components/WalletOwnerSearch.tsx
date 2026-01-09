import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  name: string;
  display_name: string | null;
  wallet_id: string;
}

const WalletOwnerSearch = () => {
  const [walletId, setWalletId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!walletId.trim()) {
      setError("Please enter a Wallet ID");
      return;
    }

    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      // First check main_wallets for direct wallet_id match
      const { data: mainWalletData, error: mainWalletError } = await supabase
        .from("main_wallets")
        .select("name, display_name, wallet_id")
        .eq("wallet_id", walletId.trim())
        .maybeSingle();

      if (mainWalletError) throw mainWalletError;

      if (mainWalletData) {
        setResult({
          name: mainWalletData.name,
          display_name: mainWalletData.display_name,
          wallet_id: mainWalletData.wallet_id || "",
        });
        return;
      }

      // If not found in main_wallets.wallet_id, check wallets table
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("main_wallet_id, wallet_id")
        .eq("wallet_id", walletId.trim())
        .maybeSingle();

      if (walletError) throw walletError;

      if (walletData) {
        // Get the main wallet owner
        const { data: ownerData, error: ownerError } = await supabase
          .from("main_wallets")
          .select("name, display_name, wallet_id")
          .eq("id", walletData.main_wallet_id)
          .maybeSingle();

        if (ownerError) throw ownerError;

        if (ownerData) {
          setResult({
            name: ownerData.name,
            display_name: ownerData.display_name,
            wallet_id: walletData.wallet_id || "",
          });
          return;
        }
      }

      setError("Wallet not found");
    } catch (err) {
      console.error("Search error:", err);
      setError("Error searching for wallet");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="p-4 bg-card border border-border rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Search className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium text-foreground">Find Wallet Owner</h3>
      </div>
      
      <div className="flex gap-2">
        <Input
          placeholder="Enter Wallet ID (e.g., Lxxxxxxx...)"
          value={walletId}
          onChange={(e) => setWalletId(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 font-mono text-sm"
        />
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      )}

      {result && (
        <div className="mt-3 p-3 bg-muted/50 rounded-md flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {result.display_name || result.name}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {result.wallet_id}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletOwnerSearch;
