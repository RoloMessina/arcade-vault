import { Suspense } from "react";
import AccesoForm from "@/components/acceso/AccesoForm";

export default function AccesoPage() {
  return (
    <Suspense>
      <AccesoForm />
    </Suspense>
  );
}
