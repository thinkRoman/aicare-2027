import { IntakeCanvas } from "@/components/consumer/IntakeCanvas";

export default function HomePage() {
  return (
    <main className="aicare-shell min-h-dvh overflow-x-hidden bg-gradient-to-b from-teal-50 via-white to-slate-50">
      <IntakeCanvas />
    </main>
  );
}
