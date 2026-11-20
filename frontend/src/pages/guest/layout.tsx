import { Outlet } from "react-router";

import { Footer } from "@/components/common/footer";
import { Header } from "@/components/common/header";

export default function GuestLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="flex-1 pb-[var(--bottom-nav-h)] md:pb-0">
        <Outlet />
      </main>
      <Footer className="pb-[calc(var(--bottom-nav-h)+1rem)] md:pb-0" />
    </div>
  );
}
