import { useState, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle } from "lucide-react";

interface WalletDeleteDialogProps {
  walletType: string;
  walletNumber: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => Promise<void>;
}

const WalletDeleteDialog = ({
  walletType,
  walletNumber,
  isOpen,
  onOpenChange,
  onConfirmDelete,
}: WalletDeleteDialogProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const transitioning = useRef(false);

  const handleFirstConfirm = () => {
    transitioning.current = true;
    setStep(2);
    // Reset after React processes the state change
    setTimeout(() => { transitioning.current = false; }, 50);
  };

  const handleSecondConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete();
    } finally {
      setIsDeleting(false);
      setStep(1);
    }
  };

  const handleCancel = () => {
    setStep(1);
    onOpenChange(false);
  };

  return (
    <>
      {/* Step 1 */}
      <AlertDialog open={isOpen && step === 1} onOpenChange={(open) => {
        if (!open && !transitioning.current) handleCancel();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to delete wallet <strong>{walletType}</strong> ({walletNumber})?
                </p>
                <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                  <p className="text-foreground">
                    <strong>Important:</strong> If you have recently sent LAN coins <em>from</em> this wallet, please wait at least <strong>24 hours</strong> before deleting it. Deleting too soon may cause those coins to be flagged as unregistered.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFirstConfirm}>
              Yes, continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 2 */}
      <AlertDialog open={isOpen && step === 2} onOpenChange={(open) => {
        if (!open && !isDeleting) handleCancel();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Final confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              This action is <strong>irreversible</strong>. The wallet will be removed from the registry and an updated KIND 30889 event will be published. Confirm deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSecondConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Yes, delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default WalletDeleteDialog;
