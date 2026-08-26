/**
 * BackgroundOrbs - Reusable background glow effects
 * Extracted to eliminate duplication across pages
 */
export type BackgroundOrbsVariant = "default" | "subtle" | "upload" | "onboarding";

interface BackgroundOrbsProps {
  variant?: BackgroundOrbsVariant;
}

export default function BackgroundOrbs({ variant = "default" }: BackgroundOrbsProps) {
  const orbStyles = {
    default: [
      "glow-large fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4",
      "fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.03] rounded-full blur-[100px] pointer-events-none translate-x-1/3",
    ],
    subtle: [
      "fixed top-0 left-0 w-[700px] h-[700px] bg-brand/10 rounded-full blur-[150px] pointer-events-none -translate-x-1/2 -translate-y-1/2",
      "fixed bottom-0 right-0 w-[600px] h-[600px] bg-brand/[0.06] rounded-full blur-[130px] pointer-events-none translate-x-1/3 translate-y-1/3",
    ],
    upload: [
      "fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-[#00E68A]/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4",
    ],
    onboarding: [
      "fixed top-0 left-0 w-[800px] h-[800px] bg-brand/10 rounded-full blur-[150px] pointer-events-none -translate-x-1/2 -translate-y-1/2",
      "fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.07] rounded-full blur-[120px] pointer-events-none translate-x-1/3",
    ],
  };

  const orbs = orbStyles[variant];

  return (
    <>
      {orbs.map((className, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={className}
        />
      ))}
    </>
  );
}
