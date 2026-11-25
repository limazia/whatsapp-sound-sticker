import { Route, Routes } from "react-router-dom";

import { ErrorLayout } from "@/app/layouts/error.layout";
import { AppLayout } from "@/app/layouts/app.layout";

export function AppRoutes() {
  return <Routes>
    <Route index element={<AppLayout />} />
    <Route path="/admin" element={<AppLayout adminView />} />
    <Route path="*" element={<ErrorLayout title="Página não encontrada" description="Confira o endereço e tente de novo." />} />
  </Routes>;
}
