import { Outlet } from "react-router-dom";
import { AiSubnav } from "./AiSubnav";

export function AiLayout() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AiSubnav />
      <Outlet />
    </div>
  );
}
