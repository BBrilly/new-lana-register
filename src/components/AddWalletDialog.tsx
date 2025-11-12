import { useState } from "react";
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
    type: "Hardware" | "Software" | "Exchange";
    description: string;
  }) => void;
}

const AddWalletDialog = ({ onAdd }: AddWalletDialogProps) => {
  const [open, setOpen] = useState(false);
  const [walletNumber, setWalletNumber] = useState("");
  const [type, setType] = useState<"Hardware" | "Software" | "Exchange">("Hardware");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletNumber || !description) {
      toast.error("Please fill in all fields");
      return;
    }
    onAdd({ walletNumber, type, description });
    setWalletNumber("");
    setDescription("");
    setType("Hardware");
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
                <SelectItem value="Hardware">Hardware</SelectItem>
                <SelectItem value="Software">Software</SelectItem>
                <SelectItem value="Exchange">Exchange</SelectItem>
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
