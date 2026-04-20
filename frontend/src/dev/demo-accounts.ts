// frontend/src/dev/demo-accounts.ts
//
// Source of truth: backend/src/backend/seed.py DEMO_USERS, dumped via
// `just gen-demo-accounts`. Regenerate the JSON when DEMO_USERS changes.
import accounts from "./demo-accounts.json";

export interface DemoAccount {
  email: string;
  label: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = accounts;
