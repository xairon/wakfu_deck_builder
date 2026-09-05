import { describe, it, expect } from "vitest";
import { useNetworkStatus } from "../useNetworkStatus";

describe("useNetworkStatus", () => {
  it("expose les états réactifs de connectivité et libellés associés", () => {
    const network = useNetworkStatus();

    expect(typeof network.isOnline.value).toBe("boolean");
    expect(typeof network.isServerConnected.value).toBe("boolean");
    expect(["online", "connecting", "offline"]).toContain(network.status.value);
    expect(network.label.value).toBeTruthy();
    expect(network.badgeClass.value).toBeTruthy();
    expect(network.dotClass.value).toBeTruthy();
  });
});
