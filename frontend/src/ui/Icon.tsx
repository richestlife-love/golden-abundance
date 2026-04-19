import type { SVGProps } from "react";

// Outlined 24x24 icon set — one visual vocabulary for the whole app.
// Line width and cap style match BottomNav so nav and inline icons read
// as the same family. Fills are reserved for the Star because a hollow
// star reads as "unearned" in gamified UI and would mislead users.

type IconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height" | "viewBox"> & {
  /** Any CSS length; defaults to 1em so the icon scales with font-size. */
  size?: number | string;
};

const baseProps = (size: IconProps["size"]) => ({
  width: size ?? "1em",
  height: size ?? "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const StarIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} fill="currentColor" stroke="none" {...rest}>
    <path d="M12 2.5 14.6 9l6.9.5-5.25 4.5L17.9 21 12 17.3 6.1 21l1.65-7L2.5 9.5 9.4 9z" />
  </svg>
);

export const CheckIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} {...rest}>
    <path d="M4 12.5 9 17.5 20 6.5" />
  </svg>
);

export const CrossIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} {...rest}>
    <path d="M6 6 18 18 M18 6 6 18" />
  </svg>
);

export const LockIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} {...rest}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
);

export const GiftIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} {...rest}>
    <rect x="3.5" y="9" width="17" height="12" rx="1.5" />
    <path d="M3.5 13h17" />
    <path d="M12 9v12" />
    <path d="M12 9s-3 0-4.5-1.5a2 2 0 0 1 2.8-2.8C11.8 6.2 12 9 12 9z" />
    <path d="M12 9s3 0 4.5-1.5a2 2 0 0 0-2.8-2.8C12.2 6.2 12 9 12 9z" />
  </svg>
);

export const ClockIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} {...rest}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 8.5V13l3 2" />
    <path d="M10 3h4" />
  </svg>
);

export const MedalIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} {...rest}>
    <path d="M7 3l2.5 6M17 3l-2.5 6" />
    <circle cx="12" cy="15" r="6" />
    <path d="M10 13.5 12 15.5 14.5 13" />
  </svg>
);

export const BabyIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} {...rest}>
    <circle cx="12" cy="9" r="5" />
    <path d="M9.5 9.5h.01M14.5 9.5h.01" />
    <path d="M10 12c.7.6 1.3.9 2 .9s1.3-.3 2-.9" />
    <path d="M9 20c0-2.5 1.5-4 3-4s3 1.5 3 4" />
    <path d="M12 14v2" />
  </svg>
);

export const CrownIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} {...rest}>
    <path d="M3 9l3 7h12l3-7-4.5 2.5L12 5l-4.5 6.5z" />
    <path d="M6 19h12" />
  </svg>
);

export const SparkleIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} fill="currentColor" stroke="none" {...rest}>
    <path d="M12 2 13.2 9.3 20.5 10.5 13.2 11.7 12 19 10.8 11.7 3.5 10.5 10.8 9.3z" />
  </svg>
);

export const CircleIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} {...rest}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

export const FlowerIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} {...rest}>
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 4.5a3 3 0 0 1 0 5M12 14.5a3 3 0 0 1 0 5M4.5 12a3 3 0 0 1 5 0M14.5 12a3 3 0 0 1 5 0" />
  </svg>
);

export const ChevronLeftIcon = ({ size, ...rest }: IconProps) => (
  <svg {...baseProps(size)} {...rest}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
