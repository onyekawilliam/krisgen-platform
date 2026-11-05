import ChangePasswordForm from "../../components/ChangePasswordForm";
import { useAuth } from "../../context/AuthContext";

export default function AdminAccount() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-1">Your account</h1>
      <p className="text-ink-dim text-sm mb-6">
        Signed in as <span className="text-ink">{user?.email}</span>. Choose a long password only you know.
      </p>
      <h2 className="font-display font-semibold mb-3">Change password</h2>
      <ChangePasswordForm />
    </div>
  );
}
