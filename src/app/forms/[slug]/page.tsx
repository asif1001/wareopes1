import { getFormTemplateBySlugAction } from "@/app/actions";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DynamicFormClient } from "./DynamicFormClient";

// Client form moved to './DynamicFormClient'
export default async function FormPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const res = await getFormTemplateBySlugAction(params.slug);
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Form" />
      <main className="flex-1 p-4 lg:p-6">
        {!res.success || !res.data ? (
          <div className="max-w-xl mx-auto w-full">
            <Card>
              <CardHeader>
                <CardTitle>Form Not Found</CardTitle>
                <CardDescription>We couldn’t find a form for slug: {params.slug}</CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <DynamicFormClient template={res.data} />
        )}
      </main>
    </div>
  );
}