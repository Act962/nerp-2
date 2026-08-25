import { Suspense } from "react";
import { LoginForm } from "../_components/login-form";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
