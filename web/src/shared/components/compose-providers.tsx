import type { ComponentType, ReactNode } from "react";

type Provider = ComponentType<{ children: ReactNode }>;

export function ComposeProviders(providers: Provider[]) {
  return function ComposedProviders({ children }: { children: ReactNode }) {
    return providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children,
    );
  };
}
