import type { Metadata } from "next";
import Lab from "./lab";

export const metadata: Metadata = { title: "Pattern lab · Common Threads" };

export default function LabPage() {
  return <Lab />;
}
