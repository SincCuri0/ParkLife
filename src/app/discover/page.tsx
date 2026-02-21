import { redirect } from "next/navigation";

export default function DiscoverPage() {
  redirect("/map?panel=discover");
}
