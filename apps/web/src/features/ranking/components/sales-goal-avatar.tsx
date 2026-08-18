"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarColorFor, initialsFor } from "../lib/avatar-color";

export function SalesGoalAvatar({
  name,
  seed,
  photoUrl,
  size = 32,
}: {
  name: string;
  seed: string;
  photoUrl?: string | null;
  // Número (px fixo) ou expressão CSS (ex: clamp(...)) para escalar
  // fluidamente com o container — usado no pódio, que encolhe bastante no mobile.
  size?: number | string;
}) {
  const color = avatarColorFor(seed);
  const sizeValue = typeof size === "number" ? `${size}px` : size;

  return (
    <Avatar
      style={{
        width: sizeValue,
        height: sizeValue,
        ["--avatar-size" as string]: sizeValue,
      }}
    >
      {photoUrl && <AvatarImage src={photoUrl} alt={name} />}
      <AvatarFallback
        style={{
          background: `radial-gradient(circle at 35% 35%, ${color}, ${color}55)`,
          color: "#fff",
          fontSize: "calc(var(--avatar-size) * 0.36)",
        }}
        className="font-bold"
      >
        {initialsFor(name)}
      </AvatarFallback>
    </Avatar>
  );
}
