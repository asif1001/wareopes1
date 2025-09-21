"use client";

import { Boxes, Warehouse, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction } from './actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function LoginButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Login
        </Button>
    );
}


export default function LoginPage() {
    const initialState = { error: null };
    const [state, formAction] = useActionState(loginAction, initialState);

    return (
        <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
            <div className="flex items-center justify-center py-12">
                <div className="mx-auto grid w-[350px] gap-6">
                    <div className="grid gap-2 text-center">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <Boxes className="h-8 w-8 text-primary" />
                            <h1 className="text-3xl font-bold font-headline">WAREOPS</h1>
                        </div>
                        <p className="text-balance text-muted-foreground">
                            Enter your credentials below to login to your account
                        </p>
                    </div>
                    <Card>
                        <form action={formAction}>
                            <CardHeader>
                                <CardTitle className="text-2xl">Login</CardTitle>
                                <CardDescription>
                                    Use your Employee No / CPR No and password to sign in.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {state.error && (
                                    <Alert variant="destructive" className="mb-4">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Login Failed</AlertTitle>
                                        <AlertDescription>{state.error}</AlertDescription>
                                    </Alert>
                                )}
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="employeeNo">Employee No / CPR No</Label>
                                        <Input id="employeeNo" name="employeeNo" placeholder="e.g., 123456789" required />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="password">Password</Label>
                                        <Input id="password" name="password" type="password" required />
                                    </div>
                                    <LoginButton />
                                </div>
                            </CardContent>
                        </form>
                    </Card>
                </div>
            </div>
            <div className="hidden bg-muted lg:flex items-center justify-center p-8">
                <div className="relative w-full h-full">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-background z-10" />
                    <Warehouse className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 text-primary/10 z-0" />
                    <div className="relative z-20 flex flex-col justify-end h-full">
                        <div className="bg-background/50 backdrop-blur-sm p-6 rounded-lg shadow-xl">
                            <h2 className="text-3xl font-bold font-headline">Streamline Your Warehouse Operations</h2>
                            <p className="text-muted-foreground mt-2">
                                Gain real-time insights, track shipments, and manage tasks with unparalleled efficiency. WAREOPS is the all-in-one solution for modern logistics.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
