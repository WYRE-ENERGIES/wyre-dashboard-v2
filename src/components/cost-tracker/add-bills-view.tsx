"use client"

import { ArrowLeftIcon } from "lucide-react"

import {
  DieselPurchaseForm,
  PaymentForm,
} from "@/components/cost-tracker/bill-forms"
import { NotAllowed } from "@/components/cost-tracker/row-actions"
import { LinkButton } from "@/components/cost-tracker/shared"
import { useCostMutation } from "@/components/cost-tracker/use-cost-tracker"
import { useClaims } from "@/components/session-provider"
import { PageHeader } from "@/components/shared/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { addDieselPurchase, addPayment } from "@/lib/api/cost-tracker"
import type {
  DieselPurchaseInput,
  PaymentInput,
  PaymentKind,
} from "@/lib/api/cost-tracker-types"
import { isOperator } from "@/lib/gating"

const PAYMENT_TABS: Array<{
  kind: PaymentKind
  tab: string
  title: string
  description: string
  success: string
}> = [
  {
    kind: "pre-paid",
    tab: "Pre-paid",
    title: "Utility payment (pre-paid)",
    description:
      "A pre-paid token bought from the grid. The tariff is worked out from the amount and value.",
    success: "Pre-paid utility payment added",
  },
  {
    kind: "post-paid",
    tab: "Post-paid",
    title: "Utility payment (post-paid)",
    description: "A post-paid grid bill and the period it covers.",
    success: "Post-paid utility payment added",
  },
  {
    kind: "ipp",
    tab: "IPP",
    title: "IPP payment",
    description: "A payment to your independent power producer.",
    success: "IPP payment added",
  },
]

/**
 * Add Bills (old mainAppPages/AddBills.js): diesel purchases, pre-paid and
 * post-paid utility payments, IPP payments. Operators only. Bills are
 * recorded for the sidebar branch.
 */
export function AddBillsView() {
  const claims = useClaims()

  return (
    <>
      <PageHeader
        title="Add bills"
        description="Record diesel purchases and energy payments for this branch."
        actions={
          <LinkButton href="/cost-tracker" variant="ghost">
            <ArrowLeftIcon />
            Cost Tracker
          </LinkButton>
        }
      />
      {isOperator(claims) ? <BillTabs /> : <NotAllowed what="add bills" />}
    </>
  )
}

function BillTabs() {
  const { user_id: userId, branch_id: branchId } = useClaims()
  const diesel = useCostMutation(
    (input: DieselPurchaseInput) => addDieselPurchase(userId, branchId, input),
    {
      success: "Diesel purchase added",
      error: "Couldn't add the diesel purchase",
    }
  )

  return (
    <Tabs defaultValue="diesel" className="max-w-3xl gap-4">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="diesel">Diesel</TabsTrigger>
        {PAYMENT_TABS.map((t) => (
          <TabsTrigger key={t.kind} value={t.kind}>
            {t.tab}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="diesel">
        <Card>
          <CardHeader>
            <CardTitle>Diesel purchase</CardTitle>
            <CardDescription>
              Diesel delivered to the facility. The amount is price per litre ×
              quantity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DieselPurchaseForm
              resetOnSuccess
              submitLabel="Add purchase"
              onSubmit={(input) => diesel.mutateAsync(input)}
            />
          </CardContent>
        </Card>
      </TabsContent>
      {PAYMENT_TABS.map((t) => (
        <TabsContent key={t.kind} value={t.kind}>
          <PaymentCard {...t} userId={userId} branchId={branchId} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function PaymentCard({
  kind,
  title,
  description,
  success,
  userId,
  branchId,
}: (typeof PAYMENT_TABS)[number] & { userId: number; branchId: number }) {
  const add = useCostMutation(
    (input: PaymentInput) => addPayment(userId, branchId, kind, input),
    {
      success,
      error: `Couldn't add the ${title.toLowerCase()}`,
    }
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <PaymentForm
          kind={kind}
          resetOnSuccess
          submitLabel="Add payment"
          onSubmit={(input) => add.mutateAsync(input)}
        />
      </CardContent>
    </Card>
  )
}
