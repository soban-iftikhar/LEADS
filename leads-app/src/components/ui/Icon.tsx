import { ICONS, type IconName } from "./icons";

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Give a label only when the icon is the sole content of a control; otherwise it is decorative. */
  label?: string;
};

export function Icon({ name, size = 18, strokeWidth = 2, className, label }: IconProps) {
  return (
    <svg
      className={`ic ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
