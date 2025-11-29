import Layout from "@/components/Layout";
import WalletCard from "@/components/WalletCard";
import AddWalletDialog from "@/components/AddWalletDialog";
import { toast } from "sonner";
import { useUserWallets } from "@/hooks/useUserWallets";
import { Skeleton } from "@/components/ui/skeleton";

const Wallets = () => {
  const { wallets, isLoading, error, fxRates, userCurrency } = useUserWallets();

  const handleAddWallet = (newWallet: {
    walletNumber: string;
    type: string;
    description: string;
  }) => {
    // TODO: Implement add wallet via Supabase
    console.log("Nova denarnica:", newWallet);
    toast.success("Wallet will be added (functionality coming soon)");
  };

  const handleDeleteWallet = (id: string) => {
    // TODO: Implement delete via Supabase
    toast.success("Wallet successfully deleted");
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Wallets</h1>
            <p className="mt-1 text-muted-foreground">
              Manage all your LAN wallets in one place
            </p>
          </div>
          <AddWalletDialog onAdd={handleAddWallet} />
        </div>

        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : error ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-xl border-2 border-dashed border-border">
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">Error loading wallets</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : wallets.length === 0 ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-xl border-2 border-dashed border-border">
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">No wallets added yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first wallet to start tracking
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {wallets.map((wallet) => (
              <WalletCard 
                key={wallet.id} 
                wallet={wallet} 
                onDelete={handleDeleteWallet}
                userCurrency={userCurrency}
                fxRates={fxRates}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Wallets;
