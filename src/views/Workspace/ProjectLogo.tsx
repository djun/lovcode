import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CubeIcon } from "@radix-ui/react-icons";

interface ProjectLogoProps {
  projectPath: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: { icon: "w-4 h-4", img: "w-5 h-5" },
  md: { icon: "w-5 h-5", img: "w-6 h-6" },
  lg: { icon: "w-6 h-6", img: "w-8 h-8" },
};

export function ProjectLogo({ projectPath, size = "sm" }: ProjectLogoProps) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    invoke<string | null>("get_project_logo", { projectPath })
      .then(setLogoSrc)
      .catch(() => setLogoSrc(null));
  }, [projectPath]);

  const classes = sizeClasses[size];

  if (!logoSrc) {
    return <CubeIcon className={`${classes.icon} text-muted-foreground flex-shrink-0`} />;
  }

  return (
    <img
      src={logoSrc}
      alt="Project logo"
      className={`${classes.img} rounded object-contain flex-shrink-0`}
    />
  );
}
