import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StyleCard } from "@/components/transform/StyleCard";
import { I18nProvider } from "@/app/lib/i18n/I18nProvider";
import type { TransformStyle } from "@/app/lib/transformStyles";

const baseStyle: TransformStyle = {
  name: "anime",
  label: "Anime",
  description: "Bold outlines, vivid colours, cel-shaded look",
  thumbnail: "/styles/anime.jpg",
  avgDurationSeconds: 45,
};

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("StyleCard badges (issue #802)", () => {
  it("renders no badges when isPremium/isNew are both absent", () => {
    renderWithI18n(<StyleCard style={baseStyle} onSelect={jest.fn()} />);
    expect(screen.queryByText("New")).not.toBeInTheDocument();
    expect(screen.queryByText("Premium")).not.toBeInTheDocument();
  });

  it("renders a New badge for isNew styles", () => {
    renderWithI18n(<StyleCard style={{ ...baseStyle, isNew: true }} onSelect={jest.fn()} />);
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.queryByText("Premium")).not.toBeInTheDocument();
  });

  it("renders a Premium badge for isPremium styles", () => {
    renderWithI18n(<StyleCard style={{ ...baseStyle, isPremium: true }} onSelect={jest.fn()} />);
    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("renders both badges when a style is both new and premium", () => {
    renderWithI18n(<StyleCard style={{ ...baseStyle, isPremium: true, isNew: true }} onSelect={jest.fn()} />);
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Premium")).toBeInTheDocument();
  });

  it("renders translated style labels and descriptions for the active locale", () => {
    window.localStorage.setItem("clipcash_locale", "es");

    renderWithI18n(
      <StyleCard style={{ ...baseStyle, name: "cinematic" }} onSelect={jest.fn()} />,
    );

    expect(screen.getByText("Cinematográfico")).toBeInTheDocument();
    expect(screen.getByText("Grano de película, color grading y destellos anamórficos")).toBeInTheDocument();
  });
});
