import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, Eye, EyeOff, Key } from "lucide-react";
import { format } from "date-fns";

interface ApiKey {
  id: string;
  service_name: string;
  contact_info: string | null;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  rate_limit_per_hour: number;
  last_request_at: string | null;
  request_count_current_hour: number;
}

interface ApiKeyFormData {
  service_name: string;
  contact_info: string;
  api_key: string;
  is_active: boolean;
  rate_limit_per_hour: number;
}

const generateApiKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'lk_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const ApiKeysManager = () => {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<ApiKeyFormData>({
    service_name: "",
    contact_info: "",
    api_key: "",
    is_active: true,
    rate_limit_per_hour: 100,
  });

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ApiKey[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ApiKeyFormData) => {
      const { error } = await supabase.from("api_keys").insert({
        service_name: data.service_name,
        contact_info: data.contact_info || null,
        api_key: data.api_key,
        is_active: data.is_active,
        rate_limit_per_hour: data.rate_limit_per_hour,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast.success("API ključ uspešno dodan");
    },
    onError: (error) => {
      toast.error(`Napaka: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ApiKeyFormData> }) => {
      const { error } = await supabase
        .from("api_keys")
        .update({
          service_name: data.service_name,
          contact_info: data.contact_info || null,
          is_active: data.is_active,
          rate_limit_per_hour: data.rate_limit_per_hour,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setEditingKey(null);
      resetForm();
      toast.success("API ključ uspešno posodobljen");
    },
    onError: (error) => {
      toast.error(`Napaka: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API ključ uspešno izbrisan");
    },
    onError: (error) => {
      toast.error(`Napaka: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      service_name: "",
      contact_info: "",
      api_key: "",
      is_active: true,
      rate_limit_per_hour: 100,
    });
  };

  const handleAddNew = () => {
    resetForm();
    setFormData((prev) => ({ ...prev, api_key: generateApiKey() }));
    setIsAddDialogOpen(true);
  };

  const handleEdit = (apiKey: ApiKey) => {
    setEditingKey(apiKey);
    setFormData({
      service_name: apiKey.service_name,
      contact_info: apiKey.contact_info || "",
      api_key: apiKey.api_key,
      is_active: apiKey.is_active,
      rate_limit_per_hour: apiKey.rate_limit_per_hour,
    });
  };

  const handleSubmit = () => {
    if (!formData.service_name.trim()) {
      toast.error("Ime storitve je obvezno");
      return;
    }
    if (!formData.api_key.trim()) {
      toast.error("API ključ je obvezen");
      return;
    }

    if (editingKey) {
      updateMutation.mutate({ id: editingKey.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Kopirano v odložišče");
  };

  const toggleShowApiKey = (id: string) => {
    setShowApiKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Ključi
          </CardTitle>
          <CardDescription>Upravljanje API ključev za zunanje storitve</CardDescription>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Dodaj ključ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dodaj nov API ključ</DialogTitle>
              <DialogDescription>Ustvari nov API ključ za zunanjo storitev</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="service_name">Ime storitve *</Label>
                <Input
                  id="service_name"
                  value={formData.service_name}
                  onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                  placeholder="npr. Moja aplikacija"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_info">Kontaktni podatki</Label>
                <Input
                  id="contact_info"
                  value={formData.contact_info}
                  onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                  placeholder="npr. email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_key">API ključ *</Label>
                <div className="flex gap-2">
                  <Input
                    id="api_key"
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setFormData({ ...formData, api_key: generateApiKey() })}
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate_limit">Rate limit (zahtev/uro)</Label>
                <Input
                  id="rate_limit"
                  type="number"
                  value={formData.rate_limit_per_hour}
                  onChange={(e) => setFormData({ ...formData, rate_limit_per_hour: parseInt(e.target.value) || 100 })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Aktiven</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Prekliči
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Dodajanje..." : "Dodaj"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !apiKeys || apiKeys.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Ni API ključev</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Storitev</TableHead>
                  <TableHead>API Ključ</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Rate Limit</TableHead>
                  <TableHead>Ustvarjen</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">{apiKey.service_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {showApiKeys.has(apiKey.id) ? apiKey.api_key : maskApiKey(apiKey.api_key)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleShowApiKey(apiKey.id)}
                        >
                          {showApiKeys.has(apiKey.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(apiKey.api_key)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {apiKey.contact_info || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {apiKey.is_active ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                          Aktiven
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
                          Neaktiven
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{apiKey.rate_limit_per_hour}/h</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(apiKey.created_at), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Dialog
                          open={editingKey?.id === apiKey.id}
                          onOpenChange={(open) => !open && setEditingKey(null)}
                        >
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(apiKey)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Uredi API ključ</DialogTitle>
                              <DialogDescription>Posodobi podatke API ključa</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit_service_name">Ime storitve *</Label>
                                <Input
                                  id="edit_service_name"
                                  value={formData.service_name}
                                  onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit_contact_info">Kontaktni podatki</Label>
                                <Input
                                  id="edit_contact_info"
                                  value={formData.contact_info}
                                  onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>API ključ (samo za branje)</Label>
                                <div className="flex gap-2">
                                  <Input value={formData.api_key} disabled className="font-mono text-sm" />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => copyToClipboard(formData.api_key)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit_rate_limit">Rate limit (zahtev/uro)</Label>
                                <Input
                                  id="edit_rate_limit"
                                  type="number"
                                  value={formData.rate_limit_per_hour}
                                  onChange={(e) =>
                                    setFormData({ ...formData, rate_limit_per_hour: parseInt(e.target.value) || 100 })
                                  }
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="edit_is_active">Aktiven</Label>
                                <Switch
                                  id="edit_is_active"
                                  checked={formData.is_active}
                                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingKey(null)}>
                                Prekliči
                              </Button>
                              <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? "Shranjevanje..." : "Shrani"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Izbriši API ključ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ali ste prepričani, da želite izbrisati API ključ za "{apiKey.service_name}"? Te
                                akcije ni mogoče razveljaviti.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Prekliči</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(apiKey.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Izbriši
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ApiKeysManager;
