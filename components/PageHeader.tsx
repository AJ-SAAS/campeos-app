// The title block every signed-in page starts with, so they all look like
// Home: a small mono eyebrow, a big serif title, and a plain description.
// Change it here and every page follows.
export function PageHeader({
  eyebrow,
  title,
  children,
  right,
  center = false,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  right?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div className={center ? "flex flex-col items-center text-center" : undefined}>
      {eyebrow && <div className="font-mono text-xs uppercase tracking-[.08em] text-muted">{eyebrow}</div>}
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-serif text-[34px] sm:text-[42px] leading-[1.05] font-medium tracking-tight mt-1.5">{title}</h1>
        {right}
      </div>
      {children && <p className={`text-[16px] text-muted mt-2 ${center ? "max-w-[560px]" : "max-w-[62ch]"}`}>{children}</p>}
    </div>
  );
}
