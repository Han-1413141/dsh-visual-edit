import React from "react";

const paths = {
  cursor:
    "M7 3H4a1 1 0 0 0-1 1v3m14-4h3a1 1 0 0 1 1 1v3M3 17v3a1 1 0 0 0 1 1h3M10 9l4 12 2-5 5-2-11-5Z",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-4 5-4 13 0 18 4-5 4-13 0-18Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  refresh: "M20 8a8 8 0 1 0 0 8M20 3v5h-5",
  help: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.5 8.5a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1-1.5 2M12 16h.01",
  desktop:
    "M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm4 17h8m-4-4v4",
  mobile:
    "M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm4 17h2",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  copy: "M8 8h12v12H8zM4 16H3V3h13v1",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-2 5 6 6",
  expand: "M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18",
  notes: "M5 3h14v18H5zM8 8h8M8 12h8M8 16h5",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  edit: "m4 16 11-11 4 4L8 20H4v-4Zm10-10 4 4",
  locate:
    "M12 2v4m0 12v4M2 12h4m12 0h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM12 10v4m-2-2h4",
  shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm-4 9 3 3 5-5",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  ...props
}: React.SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function CursorIcon(props: React.SVGProps<SVGSVGElement>) {
  return <Icon {...props} name="cursor" />;
}
