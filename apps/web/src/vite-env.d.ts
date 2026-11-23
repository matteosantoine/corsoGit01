/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_ENTRA_CLIENT_ID?: string;
  readonly VITE_ENTRA_TENANT_ID?: string;
  readonly VITE_API_SCOPE?: string;
  readonly VITE_API_URL?: string;
  /** "1" solo nella build di anteprima (servizi simulati nel browser). */
  readonly VITE_DEMO?: string;
}
