"use client";

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { SerializableShipment } from '@/lib/types';

type SortingEntry = {
  shipmentId: string;
  caseNumber: string;
  totalLines: number;
  ekcDomestic: number; // EKC (Domestic)
  ekmBulk: number; // EKM (Bulk)
};

type PackingEntry = {
  locationNo: string;
  newCaseNo: string;
  linesPacked: number;
};

type ProductivityClientPageProps = {
  initialShipments: SerializableShipment[];
};

export function ProductivityClientPage({ initialShipments }: ProductivityClientPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [date, setDate] = React.useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Sorting state
  const [sortingShipmentId, setSortingShipmentId] = React.useState<string>('');
  const [sortingCaseNumber, setSortingCaseNumber] = React.useState('');
  const [availableCases, setAvailableCases] = React.useState<string[]>([]);
  const [caseBalances, setCaseBalances] = React.useState<Record<string, number>>({});
  const [loadingCases, setLoadingCases] = React.useState<boolean>(false);
  const [sortingTotalLines, setSortingTotalLines] = React.useState<number>(0);
  const [sortingEKC, setSortingEKC] = React.useState<number>(0);
  const [sortingEKM, setSortingEKM] = React.useState<number>(0);
  const [sortingEntries, setSortingEntries] = React.useState<SortingEntry[]>([]);
  const [caseInputFocused, setCaseInputFocused] = React.useState<boolean>(false);
  const [currentCaseRemaining, setCurrentCaseRemaining] = React.useState<number>(0);

  // Packing state
  const [packingLocation, setPackingLocation] = React.useState('');
  const [packingNewCase, setPackingNewCase] = React.useState('');
  const [packingLines, setPackingLines] = React.useState<number>(0);
  const [packingEntries, setPackingEntries] = React.useState<PackingEntry[]>([]);

  // Summary
  const [dailySummary, setDailySummary] = React.useState<any | null>(null);
  const [monthlyData, setMonthlyData] = React.useState<any[]>([]);

  const shipments = React.useMemo(() => initialShipments, [initialShipments]);
  const shipmentLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const s of shipments) {
      map.set(String(s.id), `${s.source} - ${s.invoice}`);
    }
    return map;
  }, [shipments]);

  React.useEffect(() => {
    // Load case numbers when shipment changes
    (async () => {
      if (!sortingShipmentId) {
        setAvailableCases([]);
        setSortingCaseNumber('');
        setCaseInputFocused(false);
        return;
      }
      try {
        setLoadingCases(true);
        setAvailableCases([]);
        setCaseBalances({});
        setSortingCaseNumber('');
        setCaseInputFocused(false);
        const res = await fetch(`/api/production/cases?shipmentId=${encodeURIComponent(sortingShipmentId)}`);
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const json = await res.json();
        const cases: string[] = Array.isArray(json.caseNumbers) ? json.caseNumbers : [];
        setAvailableCases(cases);
        const balancesArr: any[] = Array.isArray(json.balances) ? json.balances : [];
        const balMap: Record<string, number> = {};
        for (const b of balancesArr) {
          const cn = String(b?.caseNumber || '');
          const rem = Number(b?.remainingLines || 0);
          if (cn) balMap[cn] = rem;
        }
        setCaseBalances(balMap);
      } catch (err: any) {
        toast({ title: 'Failed to load case numbers', description: String(err?.message || err), variant: 'destructive' });
      } finally {
        setLoadingCases(false);
      }
    })();
  }, [sortingShipmentId]);

  const filteredCases = React.useMemo(() => {
    const q = (sortingCaseNumber || '').toLowerCase();
    if (!q) return availableCases;
    return availableCases.filter(cn => cn.toLowerCase().includes(q));
  }, [availableCases, sortingCaseNumber]);

  async function fetchAndApplyCaseDetails(shipmentId: string, caseNumber: string) {
    try {
      const res = await fetch(`/api/production/case?shipmentId=${encodeURIComponent(shipmentId)}&caseNumber=${encodeURIComponent(caseNumber)}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load case details');
      }
      const json = await res.json();
      const data = json?.data || {};
      const tl = Number(data?.totalLines) || 0;
      const dl = Number(data?.domesticLines) || 0; // EKC (Domestic)
      const bl = Number(data?.bulkLines) || 0; // EKM (Bulk)
      const remaining = Number(data?.remainingLines ?? Math.max(0, tl - Number(data?.consumedLines || 0)));
      setCurrentCaseRemaining(remaining);
      setSortingTotalLines(Math.min(tl, remaining));
      setSortingEKC(dl);
      setSortingEKM(bl);
      setCaseInputFocused(false);
    } catch (err: any) {
      toast({ title: 'Could not load case details', description: String(err?.message || err), variant: 'destructive' });
    }
  }

  React.useEffect(() => {
    // If the entered case number matches an available case, close dropdown and fetch details
    const entered = String(sortingCaseNumber || '').trim();
    if (!entered || !sortingShipmentId) return;
    const enteredUpper = entered.toUpperCase();
    const hasMatch = availableCases.some(cn => String(cn).toUpperCase() === enteredUpper);
    if (hasMatch) {
      setCaseInputFocused(false);
      fetchAndApplyCaseDetails(sortingShipmentId, enteredUpper);
    }
  }, [sortingCaseNumber, sortingShipmentId, availableCases]);

  function addSortingEntry() {
    if (!sortingShipmentId) {
      toast({ title: 'Select a shipment first', variant: 'destructive' });
      return;
    }
    if (!sortingCaseNumber.trim()) {
      toast({ title: 'Enter a case number', variant: 'destructive' });
      return;
    }
    const enteredUpper = sortingCaseNumber.trim().toUpperCase();
    const isValidCase = availableCases.some(cn => String(cn).toUpperCase() === enteredUpper);
    if (!isValidCase) {
      toast({ title: 'Invalid case number', description: 'Please pick a case from the list', variant: 'destructive' });
      return;
    }
    if (currentCaseRemaining > 0 && Number(sortingTotalLines) > currentCaseRemaining) {
      toast({ title: 'Lines exceed remaining balance', description: `Remaining lines: ${currentCaseRemaining}`, variant: 'destructive' });
      return;
    }
    const entry: SortingEntry = {
      shipmentId: sortingShipmentId,
      caseNumber: enteredUpper,
      totalLines: Number(sortingTotalLines) || 0,
      ekcDomestic: Number(sortingEKC) || 0,
      ekmBulk: Number(sortingEKM) || 0,
    };
    setSortingEntries(prev => [...prev, entry]);
    setSortingCaseNumber('');
    setSortingTotalLines(0);
    setSortingEKC(0);
    setSortingEKM(0);
    setCurrentCaseRemaining(0);
  }

  function updateSortingEntry(index: number, patch: Partial<SortingEntry>) {
    setSortingEntries(prev => prev.map((e, i) => i === index ? { ...e, ...patch } : e));
  }

  function deleteSortingEntry(index: number) {
    setSortingEntries(prev => prev.filter((_, i) => i !== index));
  }

  function addPackingEntry() {
    if (!packingLocation.trim() || !packingNewCase.trim()) {
      toast({ title: 'Fill location and new case no.', variant: 'destructive' });
      return;
    }
    const entry: PackingEntry = {
      locationNo: packingLocation.trim().toUpperCase(),
      newCaseNo: packingNewCase.trim().toUpperCase(),
      linesPacked: Number(packingLines) || 0,
    };
    setPackingEntries(prev => [...prev, entry]);
    setPackingLocation('');
    setPackingNewCase('');
    setPackingLines(0);
  }

  function updatePackingEntry(index: number, patch: Partial<PackingEntry>) {
    setPackingEntries(prev => prev.map((e, i) => i === index ? { ...e, ...patch } : e));
  }

  function deletePackingEntry(index: number) {
    setPackingEntries(prev => prev.filter((_, i) => i !== index));
  }

  async function submitProductivity() {
    try {
      if (!user?.id) {
        toast({ title: 'Not authenticated', description: 'Please sign in', variant: 'destructive' });
        return;
      }
      const res = await fetch('/api/productivity/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          userId: user.id,
          sortingEntries,
          packingEntries,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to save productivity');
      }
      const json = await res.json();
      setDailySummary(json.summary);
      toast({ title: 'Productivity saved', description: 'Your daily productivity has been recorded.' });

      // Refresh available cases and balances for the selected shipment (reflect inventory updates)
      if (sortingShipmentId) {
        try {
          const cRes = await fetch(`/api/production/cases?shipmentId=${encodeURIComponent(sortingShipmentId)}`);
          if (cRes.ok) {
            const cJson = await cRes.json();
            const cases: string[] = Array.isArray(cJson.caseNumbers) ? cJson.caseNumbers : [];
            setAvailableCases(cases);
            const balancesArr: any[] = Array.isArray(cJson.balances) ? cJson.balances : [];
            const balMap: Record<string, number> = {};
            for (const b of balancesArr) {
              const cn = String(b?.caseNumber || '');
              const rem = Number(b?.remainingLines || 0);
              if (cn) balMap[cn] = rem;
            }
            setCaseBalances(balMap);
          }
        } catch {}
      }

      // Refresh monthly summary for graphs
      const month = date.slice(0, 7); // YYYY-MM
      const ms = await fetch(`/api/productivity/summary?userId=${encodeURIComponent(user.id)}&month=${encodeURIComponent(month)}`);
      if (ms.ok) {
        const mjson = await ms.json();
        setMonthlyData(mjson.chartData || []);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: String(err.message || err), variant: 'destructive' });
    }
  }

  React.useEffect(() => {
    // Initial load monthly summary
    (async () => {
      if (!user?.id) return;
      const d = new Date(date);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const ms = await fetch(`/api/productivity/summary?userId=${encodeURIComponent(user.id)}&month=${encodeURIComponent(month)}`);
      if (ms.ok) {
        const mjson = await ms.json();
        setMonthlyData(mjson.chartData || []);
      }
    })();
  }, [user?.id]);

  const chartConfig: any = {
    sorter: { label: 'Sorter Lines', color: 'hsl(var(--chart-1))' },
    packer: { label: 'Packer Lines', color: 'hsl(var(--chart-2))' },
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Daily Productivity</CardTitle>
          <CardDescription>Record sorting and packing productivity. Then review your daily summary.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className="w-[200px]" />
            </div>
          </div>

          <Tabs defaultValue="sorting">
            <TabsList>
              <TabsTrigger value="sorting">Sorting</TabsTrigger>
              <TabsTrigger value="packing">Packing</TabsTrigger>
            </TabsList>

            <TabsContent value="sorting" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <Label>Shipment</Label>
                  <Select value={sortingShipmentId} onValueChange={setSortingShipmentId}>
                    <SelectTrigger aria-label="Select shipment"><SelectValue placeholder="Select shipment (Source - Shipment No.)" /></SelectTrigger>
                    <SelectContent>
                      {shipments.map(s => (
                        <SelectItem key={String(s.id)} value={String(s.id)}>
                          {s.source} - {s.invoice}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="caseNo">Case No.</Label>
                  <Input
                    id="caseNo"
                    value={sortingCaseNumber}
                    onChange={e => setSortingCaseNumber(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const entered = String(sortingCaseNumber || '').trim().toUpperCase();
                        const hasMatch = availableCases.some(cn => String(cn).toUpperCase() === entered);
                        if (hasMatch) {
                          setCaseInputFocused(false);
                          if (sortingShipmentId) fetchAndApplyCaseDetails(sortingShipmentId, entered);
                        }
                      }
                    }}
                    onFocus={() => setCaseInputFocused(true)}
                    onBlur={() => setTimeout(() => setCaseInputFocused(false), 150)}
                    disabled={!sortingShipmentId || loadingCases || availableCases.length === 0}
                    placeholder={loadingCases ? 'Loading...' : (availableCases.length ? 'Type to search or pick' : 'No cases available')}
                  />
                  {caseInputFocused && (
                    <div className="mt-2 border rounded bg-background">
                      <ScrollArea className="h-40">
                        {filteredCases.length > 0 ? (
                          filteredCases.map(cn => (
                            <button
                              key={cn}
                              type="button"
                              className="w-full text-left px-2 py-1 hover:bg-muted"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => {
                                const picked = String(cn).toUpperCase();
                                setSortingCaseNumber(picked);
                                setCaseInputFocused(false);
                                if (sortingShipmentId) {
                                  fetchAndApplyCaseDetails(sortingShipmentId, picked);
                                }
                              }}
                            >
                              {cn}{typeof caseBalances[cn] === 'number' ? ` — balance ${caseBalances[cn]}` : ''}
                            </button>
                          ))
                        ) : (
                          <div className="px-2 py-2 text-sm text-muted-foreground">No matching case numbers</div>
                        )}
                      </ScrollArea>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="totalLines">Total Lines</Label>
                  <Input id="totalLines" type="number" value={sortingTotalLines} onChange={e => {
                    const val = Number(e.target.value);
                    const clamped = currentCaseRemaining > 0 ? Math.min(val, currentCaseRemaining) : val;
                    setSortingTotalLines(clamped < 0 ? 0 : clamped);
                  }} />
                </div>
                <div>
                  <Label htmlFor="ekc">EKC (Domestic)</Label>
                  <Input id="ekc" type="number" value={sortingEKC} onChange={e => setSortingEKC(Number(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="ekm">EKM (Bulk)</Label>
                  <Input id="ekm" type="number" value={sortingEKM} onChange={e => setSortingEKM(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <Button type="button" onClick={addSortingEntry}>Add Sorted Case</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment</TableHead>
                    <TableHead>Case No.</TableHead>
                    <TableHead>Total Lines</TableHead>
                    <TableHead>EKC (Domestic)</TableHead>
                    <TableHead>EKM (Bulk)</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortingEntries.map((e, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{shipmentLabelById.get(e.shipmentId) || e.shipmentId}</TableCell>
                      <TableCell>{e.caseNumber}</TableCell>
                      <TableCell>
                        <Input type="number" value={e.totalLines} onChange={ev => updateSortingEntry(idx, { totalLines: Number(ev.target.value) })} className="w-24" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={e.ekcDomestic} onChange={ev => updateSortingEntry(idx, { ekcDomestic: Number(ev.target.value) })} className="w-24" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={e.ekmBulk} onChange={ev => updateSortingEntry(idx, { ekmBulk: Number(ev.target.value) })} className="w-24" />
                      </TableCell>
                      <TableCell>
                        <Button variant="destructive" onClick={() => deleteSortingEntry(idx)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortingEntries.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No sorted cases added yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="packing" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="locNo">Loc. No.</Label>
                  <Input id="locNo" value={packingLocation} onChange={e => setPackingLocation(e.target.value)} placeholder="e.g., R12-05" />
                </div>
                <div>
                  <Label htmlFor="newCaseNo">Packed New Case No.</Label>
                  <Input id="newCaseNo" value={packingNewCase} onChange={e => setPackingNewCase(e.target.value)} placeholder="e.g., PCK-123" />
                </div>
                <div>
                  <Label htmlFor="linesPacked">No. of Lines Pack</Label>
                  <Input id="linesPacked" type="number" value={packingLines} onChange={e => setPackingLines(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <Button type="button" onClick={addPackingEntry}>Add Packed Case</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loc. No.</TableHead>
                    <TableHead>Packed New Case No.</TableHead>
                    <TableHead>No. of Lines Pack</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packingEntries.map((e, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{e.locationNo}</TableCell>
                      <TableCell>{e.newCaseNo}</TableCell>
                      <TableCell>
                        <Input type="number" value={e.linesPacked} onChange={ev => updatePackingEntry(idx, { linesPacked: Number(ev.target.value) })} className="w-24" />
                      </TableCell>
                      <TableCell>
                        <Button variant="destructive" onClick={() => deletePackingEntry(idx)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {packingEntries.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No packed cases added yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button type="button" onClick={submitProductivity}>Submit Productivity</Button>
          </div>

          {dailySummary && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Your Day Productivity</CardTitle>
                <CardDescription>Summary of what you have done today.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Sorter</h3>
                  <ul className="text-sm space-y-1">
                    <li>• Total Cases Sorted: {dailySummary.sorting.totalCases}</li>
                    <li>• Total Lines Sorted: {dailySummary.sorting.totalLines}</li>
                    <li>• Total EKC (Domestic): {dailySummary.sorting.totalEKC}</li>
                    <li>• Total EKM (Bulk): {dailySummary.sorting.totalEKM}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Packer</h3>
                  <ul className="text-sm space-y-1">
                    <li>• Total Cases Packed: {dailySummary.packing.totalCases}</li>
                    <li>• Total Lines Packed: {dailySummary.packing.totalLines}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Productivity</CardTitle>
          <CardDescription>Graph of sorter and packer lines by day.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={monthlyData} margin={{ left: -20, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Area dataKey="sorterLines" type="monotone" stroke="var(--color-sorter)" fill="var(--color-sorter)" name="Sorter Lines" />
              <Area dataKey="packerLines" type="monotone" stroke="var(--color-packer)" fill="var(--color-packer)" name="Packer Lines" />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}