import { ConnectionCenterFullSyncControl } from "../../components/distribution/ConnectionCenterFullSyncControl";
import { ConnectionCenterPage as ConnectionCenterBasePage } from "./ConnectionCenterPageBase";

export function ConnectionCenterPage() {
  return (
    <>
      <ConnectionCenterBasePage />
      <ConnectionCenterFullSyncControl />
    </>
  );
}
