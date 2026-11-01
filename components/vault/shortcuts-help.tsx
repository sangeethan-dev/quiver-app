import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  ["Ctrl+K", "Open the command palette"],
  ["N", "New prompt"],
  ["/", "Search the list"],
  ["↑ ↓ or J K", "Move selection"],
  ["Enter", "Copy the selected prompt"],
  ["F", "Toggle favorite"],
  ["E", "Edit"],
  ["Delete", "Move to trash"],
  ["?", "Show this help"],
];

const FORM_SHORTCUTS = [
  ["Enter", "Next field"],
  ["Ctrl+Enter", "Copy, or save in the editor"],
  ["Ctrl+S", "Save in the editor"],
  ["Esc", "Close"],
];

function ShortcutTable({ rows }: { rows: string[][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-1.5">
      {rows.map(([keys, action]) => (
        <div key={`${keys}-${action}`} className="contents">
          <dt className="font-mono text-xs whitespace-nowrap">{keys}</dt>
          <dd className="text-[13px] text-muted-foreground">{action}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            Keys available in the prompt list, forms and the editor.
          </DialogDescription>
        </DialogHeader>
        <ShortcutTable rows={SHORTCUTS} />
        <h3 className="text-xs font-medium text-muted-foreground">In forms and the editor</h3>
        <ShortcutTable rows={FORM_SHORTCUTS} />
      </DialogContent>
    </Dialog>
  );
}
