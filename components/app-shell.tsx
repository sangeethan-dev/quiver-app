"use client";

import { ChooseFolder } from "@/components/onboarding/choose-folder";
import { MissingFolder, ReconnectFolder } from "@/components/onboarding/reconnect-folder";
import { UnsupportedBrowser } from "@/components/onboarding/unsupported-browser";
import { StorageScreen } from "@/components/vault/storage-screen";
import { useVault, VaultProvider } from "@/lib/store";

function Screen() {
  const { state, chooseFolder, reconnect } = useVault();

  switch (state.status) {
    case "loading":
      return null;
    case "unsupported":
      return <UnsupportedBrowser />;
    case "welcome":
      return <ChooseFolder onChoose={() => void chooseFolder()} />;
    case "reconnect":
      return (
        <ReconnectFolder
          folderName={state.folderName}
          onReconnect={() => void reconnect()}
          onChooseAnother={() => void chooseFolder()}
        />
      );
    case "missing":
      return <MissingFolder folderName={state.folderName} onChoose={() => void chooseFolder()} />;
    case "ready":
      return <StorageScreen folderName={state.folderName} snapshot={state.snapshot} />;
  }
}

export function AppShell() {
  return (
    <VaultProvider>
      <Screen />
    </VaultProvider>
  );
}
