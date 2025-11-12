import { useState } from "react";
import Layout from "@/components/Layout";
import WalletCard from "@/components/WalletCard";
import AddWalletDialog from "@/components/AddWalletDialog";
import { MOCK_WALLETS } from "@/data/mockData";
import { Wallet } from "@/types/wallet";
import { toast } from "sonner";

const Wallets = () => {
  const [wallets, setWallets] = useState<Wallet[]>(MOCK_WALLETS);

  const handleAddWallet = (newWallet: {
    walletNumber: string;
    type: "Hardware" | "Software" | "Exchange";
    description: string;
  }) => {
    const wallet: Wallet = {
      id: Date.now().toString(),
      ...newWallet,
      lanAmount: 0,
      eurAmount: 0,
      events: [],
    };
    setWallets([...wallets, wallet]);
  };

  const handleDeleteWallet = (id: string) => {
    setWallets(wallets.filter((wallet) => wallet.id !== id));
    toast.success("Denarnica uspešno izbrisana");
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Denarnice</h1>
            <p className="mt-1 text-muted-foreground">
              Upravljajte vse svoje LAN denarnice na enem mestu
            </p>
          </div>
          <AddWalletDialog onAdd={handleAddWallet} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {wallets.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} onDelete={handleDeleteWallet} />
          ))}
        </div>

        {wallets.length === 0 && (
          <div className="flex min-h-[400px] items-center justify-center rounded-xl border-2 border-dashed border-border">
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">Še nimate dodanih denarnic</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Dodajte svojo prvo denarnico za začetek sledenja
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Wallets;
