import { Wallet } from "@/types/wallet";

export const MOCK_WALLETS: Wallet[] = [
  {
    id: "1",
    walletNumber: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    type: "Hardware",
    description: "Glavna denarnica za dolgoročno shranjevanje",
    lanAmount: 15420.50,
    eurAmount: 77102.50,
    events: [
      {
        id: "e1",
        timestamp: new Date("2024-01-15T10:30:00"),
        type: "unregistered_lan",
        description: "Zaznana nova neregistrirana LAN transakcija",
        amount: 250.0,
      },
      {
        id: "e2",
        timestamp: new Date("2024-01-14T15:22:00"),
        type: "transaction",
        description: "Prejeta LAN transakcija",
        amount: 500.0,
      },
    ],
    notification: {
      id: "n1",
      type: "warning",
      message: "Zaznana neobičajna aktivnost na denarnici",
      action: "Preglejte zadnje transakcije in potrdite legitimnost",
    },
  },
  {
    id: "2",
    walletNumber: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    type: "Software",
    description: "Denarnica za vsakodnevne transakcije",
    lanAmount: 3250.75,
    eurAmount: 16253.75,
    events: [
      {
        id: "e3",
        timestamp: new Date("2024-01-15T09:15:00"),
        type: "transaction",
        description: "Poslana LAN transakcija",
        amount: -150.0,
      },
    ],
    notification: {
      id: "n2",
      type: "success",
      message: "Vse transakcije so bile uspešno potrjene",
      action: "Denarnica deluje normalno",
    },
  },
  {
    id: "3",
    walletNumber: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    type: "Exchange",
    description: "Denarnica na izmenjavi Binance",
    lanAmount: 8900.00,
    eurAmount: 44500.00,
    events: [
      {
        id: "e4",
        timestamp: new Date("2024-01-15T14:45:00"),
        type: "alert",
        description: "Večja transakcija v teku",
        amount: 1000.0,
      },
      {
        id: "e5",
        timestamp: new Date("2024-01-15T11:20:00"),
        type: "unregistered_lan",
        description: "Nepoznana LAN transakcija zaznana",
        amount: 75.0,
      },
    ],
    notification: {
      id: "n3",
      type: "info",
      message: "Priporočamo prenos sredstev v hladno denarnico",
      action: "Za večjo varnost premislite o prenosu na Hardware denarnico",
    },
  },
  {
    id: "4",
    walletNumber: "0x9f8e7d6c5b4a3928170615243f5e6d7c8b9a0b1c",
    type: "Hardware",
    description: "Rezervna denarnica",
    lanAmount: 5670.25,
    eurAmount: 28351.25,
    events: [],
    notification: undefined,
  },
];

export const EUR_CONVERSION_RATE = 5.0; // 1 LAN = 5 EUR
