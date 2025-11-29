import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AddWalletDialogProps {
  onAdd: (wallet: {
    walletNumber: string;
    type: string;
    description: string;
  }) => void;
}

const AddWalletDialog = ({ onAdd }: AddWalletDialogProps) => {
  const [open, setOpen] = useState(false);
  const [walletNumber, setWalletNumber] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [walletTypes, setWalletTypes] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchWalletTypes = async () => {
      const { data, error } = await supabase
        .from("wallet_types")
        .select("id, name")
        .order("name");

      if (error) {
        console.error("Error fetching wallet types:", error);
        toast.error("Failed to load wallet types");
      } else if (data) {
        setWalletTypes(data);
        if (data.length > 0 && !type) {
          setType(data[0].name);
        }
      }
    };

    fetchWalletTypes();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletNumber || !description) {
      toast.error("Please fill in all fields");
      return;
    }
    onAdd({ walletNumber, type, description });
    setWalletNumber("");
    setDescription("");
    setType(walletTypes.length > 0 ? walletTypes[0].name : "");
    setOpen(false);
    toast.success("Wallet successfully added!");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Add Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Wallet</DialogTitle>
          <DialogDescription>
            Enter details for the new LAN wallet to track.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="walletNumber">Wallet Number</Label>
            <Input
              id="walletNumber"
              placeholder="0x..."
              value={walletNumber}
              onChange={(e) => setWalletNumber(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Wallet Type</Label>
            <Select value={type} onValueChange={(value: any) => setType(value)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {walletTypes.map((walletType) => (
                  <SelectItem key={walletType.id} value={walletType.name}>
                    {walletType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Wallet description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Wallet</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddWalletDialog;
