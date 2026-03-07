import { useFrozenWallets } from "@/hooks/useFrozenWallets";
import PublicWalletTable from "@/components/PublicWalletTable";

const FrozenWalletsPage = () => {
  const { sorted, totalBalance, isLoading, copiedId, sortField, sortDirection, toggleSort, copyWalletId } = useFrozenWallets();

  return (
    <div className="container mx-auto px-4 py-8">
      <PublicWalletTable
        wallets={sorted}
        isLoading={isLoading}
        totalBalance={totalBalance}
        title="🥶 Frozen Wallets"
        subtitle="Wallets currently frozen by the registrar"
        emptyMessage="No frozen wallets found"
        showWalletType
        sortField={sortField}
        sortDirection={sortDirection}
        toggleSort={toggleSort}
        copiedId={copiedId}
        copyWalletId={copyWalletId}
      />
    </div>
  );
};

export default FrozenWalletsPage;
