import { Suspense } from "react";
import { RegisterForm } from "../_components/register-form";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
