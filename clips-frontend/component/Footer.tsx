import Image from "next/image";
import Link from "next/link";
import { YouTubeIcon } from "@/components/icons/YouTubeIcon";
import { TwitchIcon } from "@/components/icons/TwitchIcon";
import { TikTokIcon } from "@/components/icons/TikTokIcon";
import { InstagramIcon } from "@/components/icons/InstagramIcon";

type PlatformItem = {
  label: string;
  icon: React.FC<{ className?: string; "aria-hidden"?: boolean }>;
  href: string;
};

type LegalItem = {
  label: string;
  href: string;
};

const PLATFORM_ITEMS: PlatformItem[] = [
  { label: "YouTube", icon: YouTubeIcon, href: "#" },
  { label: "Twitch", icon: TwitchIcon, href: "#" },
  { label: "TikTok", icon: TikTokIcon, href: "#" },
  { label: "Instagram", icon: InstagramIcon, href: "#" },
];

const LEGAL_ITEMS: LegalItem[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Settings", href: "/cookies" },
];

export default function Footer() {
  return (
    <footer
      className={[
        "w-full border-t border-white/[0.07]",
        "bg-[#0A0A0ACC] backdrop-blur-xl",
        "px-4 md:px-6 py-4",
      ].join(" ")}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <Image
            src="/images/logo.png"
            alt="ClipCash logo"
            height={100}
            width={400}
            className="object-cover w-28 h-auto"
          />
          <span className="text-white/30 text-xs">
            © 2024 ClipCash AI. Secure OAuth2 connection for all socials. We
            never share your private data.
          </span>
        </div>

        <nav aria-label="Partner platforms" className="flex items-center gap-6">
          {PLATFORM_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              className="grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
            >
              <item.icon aria-hidden />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {LEGAL_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={[
                "text-xs text-white/30",
                "hover:text-white/70 hover:underline",
                "transition-colors duration-150",
              ].join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
