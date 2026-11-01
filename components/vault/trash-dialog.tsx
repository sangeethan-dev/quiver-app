import { RotateCcwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/vault/confirm-dialog";
import type { TrashedFile } from "@/lib/fs/vault";
import { useVault } from "@/lib/store";
import { formatDate } from "@/lib/time";

export function TrashDialog({ onClose }: { onClose: () => void }) {
  const { listTrash, restoreFromTrash, emptyTrash } = useVault();
  const [files, setFiles] = useState<TrashedFile[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    void listTrash().then((loaded) => {
      if (active) setFiles(loaded);
    });
    return () => {
      active = false;
    };
    // Loaded once on opening; actions below reload it themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function restore(fileName: string) {
    await restoreFromTrash(fileName);
    setFiles(await listTrash());
  }

  async function empty() {
    setConfirming(false);
    await emptyTrash();
    setFiles(await listTrash());
  }

  const count = files?.length ?? 0;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Trash</DialogTitle>
            <DialogDescription>
              Deleted prompts stay in the _trash folder until you empty it.
            </DialogDescription>
          </DialogHeader>

          {files !== null && count === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Trash is empty.</p>
          )}

          {count > 0 && (
            <ul className="-mx-1 flex max-h-80 flex-col gap-0.5 overflow-y-auto">
              {files?.map((file) => (
                <li key={file.fileName} className="flex items-center gap-2 rounded-md px-1 py-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{file.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Deleted {formatDate(file.trashedAt)}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void restore(file.fileName)}>
                    <RotateCcwIcon />
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="destructive" disabled={count === 0} onClick={() => setConfirming(true)}>
              Empty trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        title="Empty the trash?"
        description={`This permanently deletes ${count} ${count === 1 ? "prompt" : "prompts"}. It can't be undone.`}
        confirmLabel="Empty trash"
        destructive
        onConfirm={() => void empty()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
