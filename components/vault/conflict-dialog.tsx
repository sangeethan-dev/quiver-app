import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConflictDialogProps {
  open: boolean;
  /** False when the file is gone or damaged, so there's no version to switch to. */
  fileIsReadable: boolean;
  onKeepMine: () => void;
  onUseFile: () => void;
  onCancel: () => void;
}

export function ConflictDialog({
  open,
  fileIsReadable,
  onKeepMine,
  onUseFile,
  onCancel,
}: ConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {fileIsReadable ? "This prompt changed outside Quiver" : "This prompt's file has gone"}
          </DialogTitle>
          <DialogDescription>
            {fileIsReadable
              ? "The file was edited after you started. Keep mine replaces it with your version, and the other text stays in History."
              : "The file was deleted, moved or damaged after you started. Keep mine writes your version back."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {fileIsReadable && (
            <Button variant="secondary" onClick={onUseFile}>
              Use the file&apos;s version
            </Button>
          )}
          <Button onClick={onKeepMine}>Keep mine</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
