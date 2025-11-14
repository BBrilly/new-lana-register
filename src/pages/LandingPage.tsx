import { Shield, TrendingUp, Calendar, Coins, Database, Activity, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  // Mock data for demonstration
  const stats = {
    registeredWallets: 493,
    todayTransactions: 14,
    yesterdayTransactions: 66,
    totalAmount: 1096322.25,
  };

  const recentBlocks = [
    {
      id: "#997090",
      stakedTime: "14/11/2025, 17:04:00",
      auditTime: "14 minutes ago",
      totalTx: 2,
      registeredTx: 0,
      coverage: 0,
    },
    {
      id: "#997089",
      stakedTime: "14/11/2025, 17:03:12",
      auditTime: "14 minutes ago",
      totalTx: 2,
      registeredTx: 0,
      coverage: 0,
    },
    {
      id: "#997088",
      stakedTime: "14/11/2025, 17:02:24",
      auditTime: "15 minutes ago",
      totalTx: 3,
      registeredTx: 1,
      coverage: 33,
    },
    {
      id: "#997087",
      stakedTime: "14/11/2025, 17:01:36",
      auditTime: "16 minutes ago",
      totalTx: 5,
      registeredTx: 2,
      coverage: 40,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">L</span>
              </div>
              <span className="text-xl font-semibold text-foreground">Lana Register</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm">
                <Database className="mr-2 h-4 w-4" />
                API Docs
              </Button>
              <Button variant="ghost" size="sm">
                <Activity className="mr-2 h-4 w-4" />
                Nostr Standards
              </Button>
              <Button onClick={() => navigate("/dashboard")} size="sm">
                Login
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-6xl font-bold text-primary">Lana Register</h1>
          <p className="text-xl text-muted-foreground">
            Transparent blockchain monitoring and wallet registration system
          </p>
        </div>

        {/* Currently Auditing */}
        <div className="mb-12 flex items-center justify-center gap-2">
          <Shield className="h-6 w-6 text-success" />
          <span className="text-lg text-foreground">
            Currently auditing <span className="font-bold text-primary">{stats.registeredWallets}</span> accounts
          </span>
        </div>

        {/* Stats Cards */}
        <div className="mb-12 grid gap-6 md:grid-cols-3">
          <Card className="bg-success/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/20">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-2xl font-bold text-foreground">{stats.todayTransactions} tx</p>
              </div>
            </div>
          </Card>

          <Card className="bg-primary/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Yesterday</p>
                <p className="text-2xl font-bold text-foreground">{stats.yesterdayTransactions} tx</p>
              </div>
            </div>
          </Card>

          <Card className="bg-secondary/50 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                <Coins className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold text-foreground">
                  {stats.totalAmount.toLocaleString('en-US')} LANA
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Feature Cards */}
        <div className="mb-12 grid gap-6 md:grid-cols-3">
          <Card className="p-6 transition-all hover:shadow-lg">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="outline">Transparent Community</Badge>
            </div>
            <h3 className="mb-2 text-xl font-bold text-foreground">Open Access</h3>
            <p className="text-muted-foreground">
              All blockchain data is publicly accessible for complete transparency
            </p>
          </Card>

          <Card className="p-6 transition-all hover:shadow-lg">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="outline">Real-time Monitoring</Badge>
            </div>
            <h3 className="mb-2 text-xl font-bold text-foreground">Live Updates</h3>
            <p className="text-muted-foreground">
              Blockchain is monitored every minute for new transactions
            </p>
          </Card>

          <Card className="p-6 transition-all hover:shadow-lg">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <Lock className="h-5 w-5 text-success" />
              </div>
              <Badge className="bg-success/20 text-success">Active</Badge>
            </div>
            <h3 className="mb-2 text-xl font-bold text-foreground">No Secrets</h3>
            <p className="text-muted-foreground">
              Everything is transparent - nothing to hide from the community
            </p>
          </Card>
        </div>

        {/* Audited Blocks Table */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Audited Blocks</h2>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            Recent blockchain blocks audited for registered wallet transactions
          </p>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Block ID</TableHead>
                  <TableHead>Staked Time</TableHead>
                  <TableHead>Audit Time</TableHead>
                  <TableHead className="text-right">Total TX</TableHead>
                  <TableHead className="text-right">Registered TX</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBlocks.map((block) => (
                  <TableRow key={block.id}>
                    <TableCell className="font-mono font-medium">{block.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{block.stakedTime}</span>
                        <span className="text-xs text-muted-foreground">16 minutes ago</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{block.auditTime}</TableCell>
                    <TableCell className="text-right">{block.totalTx}</TableCell>
                    <TableCell className="text-right">{block.registeredTx}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${block.coverage}%` }}
                          />
                        </div>
                        <span className="text-sm">{block.coverage}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 Lana Register. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
