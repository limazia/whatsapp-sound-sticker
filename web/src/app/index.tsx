import { environment } from "@/env";
import { ErrorLayout } from "@/app/layouts/error.layout";
import { AppProviders } from "@/app/providers";
import { AppRoutes } from "@/app/router";

export function App() {
  if (!environment.success) {
    return <ErrorLayout title="Configuração inválida" description="A interface precisa ser servida na raiz do site." />;
  }
  return <AppProviders><AppRoutes /></AppProviders>;
}
