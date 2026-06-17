import { redirect } from "next/navigation";

// The proxy redirects unauthenticated requests to /login; authenticated ones
// land on the dashboard.
export default function Home() {
  redirect("/dashboard");
}
