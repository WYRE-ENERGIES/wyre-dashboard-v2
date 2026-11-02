import { redirect } from "next/navigation"

/** /parameters has no page of its own; open the first Parameters page. */
export default function ParametersIndex() {
  redirect("/parameters/energy-consumption")
}
