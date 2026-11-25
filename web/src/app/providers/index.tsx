import { BrowserRouter } from "react-router-dom";

import type { ReactNode } from "react";

import { ComposeProviders } from "@components/compose-providers";

import { QueryClientProviderWrapper } from "./wrappers";

const OuterProviders = ComposeProviders([QueryClientProviderWrapper]);

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return <OuterProviders><BrowserRouter>{children}</BrowserRouter></OuterProviders>;
}
