import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import { getNocRedirect, isNocAllowedPath, NOC_HOME_PATH } from "../noc-routes";

// What the middleware reads: the path without its query
const pathnameOf = (path: string) => new URL(path, "http://keep.test").pathname;

describe("the pages a NOC user may open", () => {
  // The gateway refuses a NOC user the links this predicate would redirect
  it.each(golden.navigation.vectors.filter((vector) => vector.page !== null))(
    "agree with the gateway for $role $path",
    ({ path, noc_allowed }) => {
      expect(isNocAllowedPath(pathnameOf(path))).toBe(noc_allowed);
    }
  );

  it("are the alerts pages", () => {
    expect(isNocAllowedPath("/alerts/feed")).toBe(true);
    expect(isNocAllowedPath("/alerts/payments")).toBe(true);
    expect(isNocAllowedPath("/incidents")).toBe(false);
    expect(isNocAllowedPath("/")).toBe(false);
  });
});

describe("getNocRedirect", () => {
  it("sends a NOC user to the feed from any other page", () => {
    expect(getNocRedirect("noc", "/incidents")).toBe(NOC_HOME_PATH);
    expect(getNocRedirect("noc", "/dashboard/Ops")).toBe("/alerts/feed");
    expect(getNocRedirect("noc", "/alerts/feed")).toBeNull();
  });

  it.each(["admin", "viewer", undefined, null, "NOC"])(
    "lets a %p user through",
    (role) => {
      expect(getNocRedirect(role, "/incidents")).toBeNull();
    }
  );
});
