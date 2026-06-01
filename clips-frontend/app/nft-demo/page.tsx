import { notFound } from "next/navigation";
import NFTDemoContent from "./NFTDemoContent";

export default function NFTDemoPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <NFTDemoContent />;
}
