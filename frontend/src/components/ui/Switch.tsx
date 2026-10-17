import type { CSSProperties, InputHTMLAttributes } from "react";

type SwitchSize = "md" | "sm";

// Track and thumb geometry per size. The thumb travels track width - thumb - 2 * inset.
const SIZE: Record<SwitchSize, { track: string; thumb: string; travel: string }> = {
  md: { track: "w-[42px] h-[24px]", thumb: "w-[18px] h-[18px]", travel: "peer-checked:translate-x-[18px]" },
  sm: { track: "w-[30px] h-[18px]", thumb: "w-[12px] h-[12px]", travel: "peer-checked:translate-x-[12px]" },
};

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role" | "size"> & {
  size?: SwitchSize;
  /** Any CSS colour for the on state; defaults to the realm accent. */
  color?: string;
};

// On/off control. The real checkbox stays in the DOM, invisible and on top,
// so label association, keyboard (Space) and screen readers come with it and
// only the drawing is custom. Position carries the state as well as colour.
export function Switch({ size = "md", color, className = "", style, ...props }: SwitchProps) {
  const { track, thumb, travel } = SIZE[size];
  return (
    <span className={`relative inline-flex flex-none ${className}`} style={{ ...style, ...(color ? { "--switch-color": color } : null) } as CSSProperties}>
      <input
        type="checkbox"
        role="switch"
        className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none block rounded-full bg-[color-mix(in_srgb,var(--text)_16%,transparent)] transition-[background] duration-150 ease-[ease] motion-reduce:transition-none peer-checked:bg-[color-mix(in_srgb,var(--switch-color,var(--accent))_45%,transparent)] peer-focus-visible:shadow-[0_0_0_2px_var(--ring)] peer-disabled:opacity-50 ${track}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-[3px] top-[3px] rounded-full bg-muted transition-[transform,background] duration-150 ease-[ease] motion-reduce:transition-none peer-checked:bg-[var(--switch-color,var(--accent))] peer-disabled:opacity-50 ${thumb} ${travel}`}
      />
    </span>
  );
}
