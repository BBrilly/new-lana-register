import { useState } from "react";
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
import { Loader2 } from "lucide-react";

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

  const handleFirstConfirm = () => {
    setStep(2);
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
        if (!open) handleCancel();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ali ste prepričani?</AlertDialogTitle>
            <AlertDialogDescription>
              Ali ste prepričani, da želite zbrisati denarnico <strong>{walletType}</strong> ({walletNumber})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Prekliči</AlertDialogCancel>
            <AlertDialogAction onClick={handleFirstConfirm}>
              Da, nadaljuj
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
            <AlertDialogTitle className="text-destructive">Končna potrditev</AlertDialogTitle>
            <AlertDialogDescription>
              To dejanje je <strong>nepovratno</strong>. Denarnica bo odstranjena iz registra in objavljen bo posodobljen KIND 30889 event. Potrdite brisanje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} disabled={isDeleting}>
              Prekliči
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSecondConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Brišem...
                </>
              ) : (
                "Da, zbriši"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default WalletDeleteDialog;
