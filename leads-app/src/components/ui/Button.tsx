import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import type { IconName } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "ink" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "m",
  secondary: "",
  ink: "ink",
  ghost: "ghost",
  danger: "danger",
};

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
  loading?: boolean;
  /** Label shown while loading, e.g. "Logging in…". */
  loadingLabel?: string;
  className?: string;
  children?: ReactNode;
};

type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
type AsLink = Common & {
  href: string;
  external?: boolean;
  target?: string;
  rel?: string;
  download?: boolean;
  "aria-label"?: string;
  onClick?: () => void;
};

const OWN_KEYS = ["variant", "size", "icon", "iconRight", "full", "loading", "loadingLabel", "className", "children", "disabled", "type", "onClick"] as const;

export function Button(props: AsButton | AsLink) {
  const { variant = "secondary", size = "md", icon, iconRight, full, loading, loadingLabel, className, children } = props;
  const cls = cx("btn", VARIANT[variant], size !== "md" && size, full && "full", className);
  const iconSize = size === "lg" ? 18 : size === "sm" ? 16 : 18;
  const content = (
    <>
      {loading ? <span className="spin" aria-hidden="true" /> : icon && <Icon name={icon} size={iconSize} />}
      {loading && loadingLabel ? loadingLabel : children}
      {!loading && iconRight && <Icon name={iconRight} size={iconSize} />}
    </>
  );

  if (props.href !== undefined) {
    const { href, external, target, rel, download, onClick } = props;
    if (external || download || href.startsWith("tel:") || href.startsWith("http")) {
      return (
        <a className={cls} href={href} target={target} rel={rel} download={download} aria-label={props["aria-label"]} onClick={onClick}>
          {content}
        </a>
      );
    }
    return (
      <Link className={cls} href={href} aria-label={props["aria-label"]} onClick={onClick}>
        {content}
      </Link>
    );
  }

  const rest: ButtonHTMLAttributes<HTMLButtonElement> = { ...props };
  for (const k of OWN_KEYS) delete (rest as Record<string, unknown>)[k];
  const { disabled, type, onClick } = props;
  return (
    <button
      {...rest}
      type={type ?? "button"}
      className={cls}
      // aria-disabled keeps the button focusable so its explanation can be read
      aria-disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      data-disabled={disabled || loading ? "" : undefined}
      onClick={disabled || loading ? (e) => e.preventDefault() : onClick}
    >
      {content}
    </button>
  );
}
