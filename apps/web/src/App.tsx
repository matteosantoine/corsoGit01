import { AuthGate, signOut } from "./auth/AuthGate";
import { Home } from "./screens/Home";

export default function App() {
  return (
    <AuthGate>
      {(account) => (
        <Home
          userName={account?.name ?? null}
          onSignOut={account ? () => void signOut() : undefined}
        />
      )}
    </AuthGate>
  );
}
