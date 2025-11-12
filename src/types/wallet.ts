export interface Wallet {
  id: string;
  walletNumber: string;
  type: "Hardware" | "Software" | "Exchange";
  description: string;
  lanAmount: number;
  eurAmount: number;
  events: WalletEvent[];
  notification?: WalletNotification;
}

export interface WalletEvent {
  id: string;
  timestamp: Date;
  type: "unregistered_lan" | "transaction" | "alert";
  description: string;
  amount?: number;
}

export interface WalletNotification {
  id: string;
  type: "info" | "warning" | "success";
  message: string;
  action?: string;
}
