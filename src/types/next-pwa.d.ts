declare module "next-pwa" {
  import type { NextConfig } from "next";

  type PWAOptions = {
    dest: string;
    disable?: boolean;
  };

  const withPWAInit: (options: PWAOptions) => (config: NextConfig) => NextConfig;
  export default withPWAInit;
}
