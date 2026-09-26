import React from "react";
import { render, screen } from "@testing-library/react";
import LandingHero from "@/components/layout/LandingHero";
import {
  LANDING_HERO_PRIMARY_AVATAR_SRC,
  landingHeroAvatarSrc,
} from "@/app/lib/resourceHints";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    priority,
  }: {
    src: string;
    alt: string;
    priority?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      data-priority={priority ? "true" : "false"}
    />
  ),
}));

describe("LandingHero resource hints", () => {
  it("marks only the first avatar for next/image priority preload", () => {
    render(<LandingHero />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(images[0]).toHaveAttribute("src", LANDING_HERO_PRIMARY_AVATAR_SRC);
    expect(images[0]).toHaveAttribute("data-priority", "true");
    expect(images[1]).toHaveAttribute("src", landingHeroAvatarSrc("Aneka"));
    expect(images[1]).toHaveAttribute("data-priority", "false");
    expect(images[2]).toHaveAttribute("src", landingHeroAvatarSrc("Jocelyn"));
    expect(images[2]).toHaveAttribute("data-priority", "false");
  });
});
