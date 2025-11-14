import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Trash2, Plus, Loader2, Users, Wallet } from 'lucide-react';
import Layout from '@/components/Layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface AdminUser {
  id: string;
  nostr_hex_id: string;
  created_at: string;
}

interface MainWallet {
  id: string;
  nostr_hex_id: string;
  wallet_id: string;
  name: string;
  status: string;
  created_at: string;
}

const AdminPanel = () => {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [mainWallets, setMainWallets] = useState<MainWallet[]>([]);
  const [newAdminHexId, setNewAdminHexId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch admin users
      const { data: admins, error: adminsError } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (adminsError) throw adminsError;
      setAdminUsers(admins || []);

      // Fetch main wallets
      const { data: wallets, error: walletsError } = await supabase
        .from('main_wallets')
        .select('*')
        .order('created_at', { ascending: false });

      if (walletsError) throw walletsError;
      setMainWallets(wallets || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newAdminHexId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a Nostr hex ID',
        variant: 'destructive',
      });
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from('admin_users')
        .insert({ nostr_hex_id: newAdminHexId.trim() });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Admin user added successfully',
      });

      setNewAdminHexId('');
      fetchData();
    } catch (error: any) {
      console.error('Error adding admin:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add admin user',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    try {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Admin user removed successfully',
      });

      fetchData();
    } catch (error: any) {
      console.error('Error deleting admin:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove admin user',
        variant: 'destructive',
      });
    }
  };

  const triggerSync = async () => {
    try {
      toast({
        title: 'Sync started',
        description: 'Wallet synchronization has been triggered',
      });

      const { error } = await supabase.functions.invoke('sync-wallet-kind-30889');

      if (error) throw error;

      toast({
        title: 'Sync completed',
        description: 'Wallets have been synchronized',
      });

      fetchData();
    } catch (error: any) {
      console.error('Error triggering sync:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to trigger sync',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Admin Panel
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage administrators and monitor wallet synchronization
            </p>
          </div>
          <Button onClick={triggerSync} variant="outline">
            <Wallet className="mr-2 h-4 w-4" />
            Trigger Sync
          </Button>
        </div>

        {/* Admin Users Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Administrator Users
            </CardTitle>
            <CardDescription>
              Manage users with administrative access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddAdmin} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="nostr-hex-id" className="sr-only">
                  Nostr Hex ID
                </Label>
                <Input
                  id="nostr-hex-id"
                  placeholder="Enter Nostr hex ID (64 characters)"
                  value={newAdminHexId}
                  onChange={(e) => setNewAdminHexId(e.target.value)}
                  maxLength={64}
                />
              </div>
              <Button type="submit" disabled={isAdding}>
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Admin
                  </>
                )}
              </Button>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nostr Hex ID</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No admin users found
                    </TableCell>
                  </TableRow>
                ) : (
                  adminUsers.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-mono text-sm">
                        {admin.nostr_hex_id.substring(0, 16)}...
                      </TableCell>
                      <TableCell>
                        {new Date(admin.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove admin user?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will revoke administrative access for this user.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteAdmin(admin.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Main Wallets Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Main Wallets ({mainWallets.length})
            </CardTitle>
            <CardDescription>
              Overview of all synchronized main wallets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Wallet ID</TableHead>
                  <TableHead>Nostr Hex ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mainWallets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No wallets found
                    </TableCell>
                  </TableRow>
                ) : (
                  mainWallets.map((wallet) => (
                    <TableRow key={wallet.id}>
                      <TableCell className="font-medium">{wallet.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {wallet.wallet_id?.substring(0, 12)}...
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {wallet.nostr_hex_id.substring(0, 12)}...
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          wallet.status === 'active' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {wallet.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(wallet.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminPanel;
