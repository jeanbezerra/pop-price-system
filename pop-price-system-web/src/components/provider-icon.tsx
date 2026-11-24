"use client";

import { makeStyles } from "@fluentui/react-components";

const providers: Record<string, { name: string; image: string }> = {
  AWS: { name: "AWS", image: "/providers/aws.svg" },
  AZURE: { name: "Azure", image: "/providers/azure.svg" },
  GCP: { name: "GCP", image: "/providers/gcp.svg" },
};
const useStyles = makeStyles({
  image: {
    display: "block",
    width: "36px",
    height: "32px",
    objectFit: "contain",
  },
});

export function ProviderIcon({
  provider,
  decorative = false,
}: {
  provider: string;
  decorative?: boolean;
}) {
  const styles = useStyles();
  const known = providers[provider.toUpperCase()];
  return known ? (
    <img
      className={styles.image}
      src={known.image}
      width={36}
      height={32}
      alt={decorative ? "" : known.name}
    />
  ) : (
    <span>{provider}</span>
  );
}
