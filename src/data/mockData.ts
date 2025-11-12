import { Wallet } from "@/types/wallet";

export const MOCK_WALLETS: Wallet[] = [
  {
    id: "1",
    walletNumber: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    type: "Hardware",
    description: "Main wallet for long-term storage",
    lanAmount: 15420.50,
    eurAmount: 77102.50,
    events: [
      {
        id: "e1",
        timestamp: new Date("2024-01-15T10:30:00"),
        type: "unregistered_lan",
        description: "New unregistered LAN transaction detected",
        amount: 250.0,
      },
      {
        id: "e2",
        timestamp: new Date("2024-01-14T15:22:00"),
        type: "transaction",
        description: "Received LAN transaction",
        amount: 500.0,
      },
    ],
    notification: {
      id: "n1",
      type: "warning",
      message: "Unusual activity detected on wallet",
      action: "Review recent transactions and confirm legitimacy",
    },
  },
  {
    id: "2",
    walletNumber: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    type: "Software",
    description: "Wallet for everyday transactions",
    lanAmount: 3250.75,
    eurAmount: 16253.75,
    events: [
      {
        id: "e3",
        timestamp: new Date("2024-01-15T09:15:00"),
        type: "transaction",
        description: "Sent LAN transaction",
        amount: -150.0,
      },
    ],
    notification: {
      id: "n2",
      type: "success",
      message: "All transactions have been successfully confirmed",
      action: "Wallet is operating normally",
    },
  },
  {
    id: "3",
    walletNumber: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    type: "Exchange",
    description: "Wallet on Binance exchange",
    lanAmount: 8900.00,
    eurAmount: 44500.00,
    events: [
      {
        id: "e4",
        timestamp: new Date("2024-01-15T14:45:00"),
        type: "alert",
        description: "Large transaction in progress",
        amount: 1000.0,
      },
      {
        id: "e5",
        timestamp: new Date("2024-01-15T11:20:00"),
        type: "unregistered_lan",
        description: "Unknown LAN transaction detected",
        amount: 75.0,
      },
    ],
    notification: {
      id: "n3",
      type: "info",
      message: "We recommend transferring funds to cold storage",
      action: "For greater security, consider transferring to a Hardware wallet",
    },
  },
  {
    id: "4",
    walletNumber: "0x9f8e7d6c5b4a3928170615243f5e6d7c8b9a0b1c",
    type: "Hardware",
    description: "Backup wallet",
    lanAmount: 5670.25,
    eurAmount: 28351.25,
    events: [],
    notification: undefined,
  },
];

export const EUR_CONVERSION_RATE = 5.0; // 1 LAN = 5 EUR
