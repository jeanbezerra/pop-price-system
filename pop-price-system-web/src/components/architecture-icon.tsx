"use client";

import { useState } from "react";
import { makeStyles } from "@fluentui/react-components";
import { CloudRegular } from "@fluentui/react-icons";
import type { ArchitectureIconDefinition } from "@/lib/component-contracts";

const useStyles = makeStyles({
  image: { display: "block", objectFit: "contain", flexShrink: 0 },
});

export function ArchitectureIcon({
  icon,
  size = 40,
  alt = "",
}: {
  icon: Pick<ArchitectureIconDefinition, "assetPath"> | null;
  size?: 32 | 40 | 64;
  alt?: string;
}) {
  const styles = useStyles();
  const [failedPath, setFailedPath] = useState("");
  // Only bundled assets are renderable. Never load an arbitrary URL from API data.
  const local =
    icon &&
    /^\/architecture-icons\/[a-z0-9-]+\/\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.svg$/.test(
      icon.assetPath,
    );
  if (!local || failedPath === icon.assetPath)
    return (
      <CloudRegular
        fontSize={size}
        aria-hidden={alt ? undefined : true}
        aria-label={alt || undefined}
        role={alt ? "img" : undefined}
      />
    );
  return (
    <img
      className={styles.image}
      src={icon.assetPath}
      width={size}
      height={size}
      alt={alt}
      onError={() => setFailedPath(icon.assetPath)}
    />
  );
}
