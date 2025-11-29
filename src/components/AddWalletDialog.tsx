import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Html5Qrcode } from "html5-qrcode";
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
import { Plus, QrCode } from "lucide-react";
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
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

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

  // Cleanup scanner on unmount or dialog close
  useEffect(() => {
    if (!open && scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
      setIsScanning(false);
    }
  }, [open]);

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

  const startScanning = async () => {
    setIsScanning(true);
    
    setTimeout(async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        
        if (!cameras || cameras.length === 0) {
          toast.error("No camera found on this device");
          setIsScanning(false);
          return;
        }

        let selectedCamera = cameras[0];
        if (cameras.length > 1) {
          const backCamera = cameras.find(camera => 
            camera.label.toLowerCase().includes('back') || 
            camera.label.toLowerCase().includes('rear')
          );
          if (backCamera) {
            selectedCamera = backCamera;
          }
        }

        const scanner = new Html5Qrcode("qr-reader-wallet");
        scannerRef.current = scanner;

        await scanner.start(
          selectedCamera.id,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            setWalletNumber(decodedText);
            stopScanning();
            toast.success("Wallet ID scanned successfully");
          },
          (errorMessage) => {
            // Ignore during operation
          }
        );
      } catch (error: any) {
        console.error("Error starting QR scanner:", error);
        setIsScanning(false);
        
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          toast.error("Camera permission denied. Please allow camera access.");
        } else if (error.name === "NotFoundError") {
          toast.error("No camera found on this device");
        } else if (error.name === "NotReadableError") {
          toast.error("Camera is already in use by another application");
        } else {
          toast.error(`Error starting camera: ${error.message || "Unknown error"}`);
        }
      }
    }, 100);
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
    setIsScanning(false);
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
              placeholder="LZgUUQALhZbCoQrUXEDDwJS1Pb99E1bJ27..."
              value={walletNumber}
              onChange={(e) => setWalletNumber(e.target.value)}
              className="font-mono"
              disabled={isScanning}
            />
            {!isScanning ? (
              <Button
                type="button"
                variant="outline"
                onClick={startScanning}
                className="w-full gap-2"
              >
                <QrCode className="h-4 w-4" />
                Scan Wallet QR Code
              </Button>
            ) : (
              <div className="space-y-4">
                <div
                  id="qr-reader-wallet"
                  ref={scannerDivRef}
                  className="rounded-lg overflow-hidden border-2 border-primary"
                />
                <Button
                  type="button"
                  variant="destructive"
                  onClick={stopScanning}
                  className="w-full"
                >
                  Stop Scanning
                </Button>
              </div>
            )}
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isScanning}>
              Cancel
            </Button>
            <Button type="submit" disabled={isScanning}>Add Wallet</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddWalletDialog;
