import { useState } from "react";
import Layout from "@/components/Layout";
import StatCard from "@/components/StatCard";
import AddWalletDialog from "@/components/AddWalletDialog";
import { MOCK_WALLETS, EUR_CONVERSION_RATE } from "@/data/mockData";
import { Wallet } from "@/types/wallet";
import { Wallet as WalletIcon, TrendingUp, Euro, Activity } from "lucide-react";

const Dashboard = () => {
  const [wallets] = useState<Wallet[]>(MOCK_WALLETS);

  const totalLan = wallets.reduce((sum, wallet) => sum + wallet.lanAmount, 0);
  const totalEur = wallets.reduce((sum, wallet) => sum + wallet.eurAmount, 0);
  const totalWallets = wallets.length;
  const unreadEvents = wallets.reduce((sum, wallet) => sum + wallet.events.length, 0);

  const handleAddWallet = (newWallet: {
    walletNumber: string;
    type: "Hardware" | "Software" | "Exchange";
    description: string;
  }) => {
    console.log("Nova denarnica:", newWallet);
    // V prihodnosti: dodaj v state ali pošlji na backend
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Pregled vseh LAN denarnic in skupne vrednosti
            </p>
          </div>
          <AddWalletDialog onAdd={handleAddWallet} />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Skupaj LAN"
            value={totalLan.toLocaleString("sl-SI", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            subtitle="Vseh denarnic"
            icon={<WalletIcon className="h-6 w-6" />}
            trend={{ value: "12.5%", isPositive: true }}
          />
          <StatCard
            title="Skupaj EUR"
            value={`€ ${totalEur.toLocaleString("sl-SI", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            subtitle={`Menjalni tečaj: 1 LAN = ${EUR_CONVERSION_RATE} EUR`}
            icon={<Euro className="h-6 w-6" />}
            trend={{ value: "8.2%", isPositive: true }}
          />
          <StatCard
            title="Aktivne Denarnice"
            value={totalWallets.toString()}
            subtitle="Registrirane denarnice"
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Nepreglerjeni Eventi"
            value={unreadEvents.toString()}
            subtitle="Zahtevajo vašo pozornost"
            icon={<Activity className="h-6 w-6" />}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold text-foreground">Hitri Pregled Denarnic</h2>
          <div className="mt-4 space-y-3">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <WalletIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{wallet.description}</p>
                    <p className="text-sm text-muted-foreground">{wallet.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">
                    {wallet.lanAmount.toLocaleString("sl-SI", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    LAN
                  </p>
                  <p className="text-sm text-muted-foreground">
                    €{" "}
                    {wallet.eurAmount.toLocaleString("sl-SI", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
