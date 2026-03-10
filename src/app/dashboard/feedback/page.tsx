import {
    PlusCircle,
  } from "lucide-react"
  import { Badge } from "@/components/ui/badge"
  import { Button } from "@/components/ui/button"
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
  import { DashboardHeader } from "@/components/dashboard-header"
  import { feedback } from "@/lib/data"
  import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
  import { cn } from "@/lib/utils"
  
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Resolved':
      case 'Closed':
        return 'default';
      case 'In Review':
        return 'secondary';
      case 'Open':
        return 'destructive';
      default:
        return 'default';
    }
  };
  
  export default function FeedbackPage() {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Feedback & Complaints" />
        <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
          <Tabs defaultValue="all">
            <div className="flex items-center">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
              </TabsList>
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" className="h-8 gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Submit Feedback
                  </span>
                </Button>
              </div>
            </div>
            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>Feedback & Complaints</CardTitle>
                  <CardDescription>
                    Track and manage all user-submitted issues and suggestions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead className="w-[40%]">Subject</TableHead>
                        <TableHead className="hidden md:table-cell">Submitted By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feedback.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Badge variant={item.type === 'Complaint' ? 'destructive' : 'outline'}>{item.type}</Badge>
                            </TableCell>
                          <TableCell className="font-medium">{item.subject}</TableCell>
                          <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                      <AvatarImage src={item.submittedByAvatar} alt={item.submittedBy} data-ai-hint="person portrait" />
                                      <AvatarFallback>{item.submittedBy.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <span>{item.submittedBy}</span>
                              </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
                          </TableCell>
                          <TableCell>{item.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    )
  }
  