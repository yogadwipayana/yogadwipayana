import { redirect } from "next/navigation";

// The model pricing lives on the /ai page under the #models anchor.
export default function ModelsPage() {
  redirect("/ai#models");
}
