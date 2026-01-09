import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import StatCard from "@/components/StatCard";
import AddWalletDialog from "@/components/AddWalletDialog";

import { Wallet as WalletIcon, TrendingUp, DollarSign, Activity } from "lucide-react";
import { isAuthenticated, getAuthSession, getUserProfile } from "@/utils/wifAuth";
import { useUserWallets } from "@/hooks/useUserWallets";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = () => {
  const navigate = useNavigate();
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const { wallets, isLoading, error, fxRates, userCurrency } = useUserWallets();

  // Check authentication on mount
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
    } else {
      setIsAuthChecked(true);
    }
  }, [navigate]);

  // Don't render until auth is checked
  if (!isAuthChecked) {
    return null;
  }

  const authSession = getAuthSession();
  const userProfile = getUserProfile();

  const totalLan = wallets.reduce((sum, wallet) => sum + wallet.lanAmount, 0);
  const totalFiat = wallets.reduce((sum, wallet) => sum + wallet.eurAmount, 0);
  const totalWallets = wallets.length;
  const unreadEvents = wallets.reduce((sum, wallet) => sum + wallet.events.length, 0);

  // Get currency symbol
  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case "EUR": return "€";
      case "USD": return "$";
      case "GBP": return "£";
      default: return currency;
    }
  };

  const currencySymbol = getCurrencySymbol(userCurrency);
  const exchangeRate = fxRates?.[userCurrency as keyof typeof fxRates] || 0;

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
        {/* Welcome Message with Profile */}
        {userProfile && (
          <div className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Welcome back, {userProfile.display_name || userProfile.name}!
            </h2>
            {userProfile.about && (
              <p className="text-muted-foreground mb-3">{userProfile.about}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              {userProfile.location && (
                <span className="text-muted-foreground">📍 {userProfile.location}</span>
              )}
              {userProfile.currency && (
                <span className="text-muted-foreground">💰 {userProfile.currency}</span>
              )}
              {userProfile.whoAreYou && (
                <span className="text-muted-foreground">👤 {userProfile.whoAreYou}</span>
              )}
            </div>
          </div>
        )}


        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Overview of all LAN wallets and total value
            </p>
          </div>
          <AddWalletDialog onAdd={handleAddWallet} />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total LAN"
            value={totalLan.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            subtitle="All wallets"
            icon={<WalletIcon className="h-6 w-6" />}
          />
          <StatCard
            title={`Total ${userCurrency}`}
            value={`${currencySymbol} ${totalFiat.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            subtitle={`Exchange rate: 1 LAN = ${exchangeRate.toFixed(6)} ${userCurrency}`}
            icon={<DollarSign className="h-6 w-6" />}
          />
          <StatCard
            title="Active Wallets"
            value={totalWallets.toString()}
            subtitle="Registered wallets"
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Unreviewed Events"
            value={unreadEvents.toString()}
            subtitle="Require your attention"
            icon={<Activity className="h-6 w-6" />}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold text-foreground">Quick Wallet Overview</h2>
          <div className="mt-4 space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : error ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Error loading wallets: {error}</p>
              </div>
            ) : wallets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No wallets found</p>
              </div>
            ) : (
              wallets.map((wallet) => {
                const isMainWallet = wallet.type.toLowerCase().includes("main");
                const isLana8Wonder = wallet.type.toLowerCase().includes("lana8wonder");
                
                return (
                  <div
                    key={wallet.id}
                    className={`flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                      isMainWallet 
                        ? "border-success/50 bg-success/5" 
                        : isLana8Wonder 
                        ? "border-orange-500/50 bg-orange-500/5" 
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        isMainWallet ? "bg-success/10" : isLana8Wonder ? "bg-orange-500/10" : "bg-primary/10"
                      }`}>
                        <WalletIcon className={`h-5 w-5 ${
                          isMainWallet ? "text-success" : isLana8Wonder ? "text-orange-500" : "text-primary"
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{wallet.type}</p>
                        <p className="text-sm text-muted-foreground">{wallet.description}</p>
                        <p className="font-mono text-xs text-muted-foreground">ID: {wallet.walletNumber}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-foreground">
                        {wallet.lanAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        LAN
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {currencySymbol}{" "}
                        {wallet.eurAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
