import { Outlet } from "react-router";

import { Footer } from "@/components/common/footer";
import { Header } from "@/components/common/header";

export default function PublicPageLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-[calc(var(--bottom-nav-h)+2rem)] sm:px-6 sm:py-10 md:pb-10">
        <Outlet />
      </main>
      <Footer className="pb-[calc(var(--bottom-nav-h)+1rem)] md:pb-0" />
    </div>
  );
}