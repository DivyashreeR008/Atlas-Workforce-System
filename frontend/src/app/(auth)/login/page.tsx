"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/stores/toast-store";

const schema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
      toast({ title: "Welcome back", description: "Signed in successfully." });
      router.push("/dashboard");
    } catch {
      toast({
        title: "Sign in failed",
        description: "Invalid email or password.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-white/10 bg-white/5 text-white shadow-2xl backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Sign in to Atlas</CardTitle>
        <CardDescription className="text-slate-300">
          Enterprise workforce management
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="REDACTED_EMAIL"
              className="border-white/20 bg-white/10 text-white placeholder:text-slate-400"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-red-400">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              className="border-white/20 bg-white/10 text-white"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-red-400">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          No account?{" "}
          <Link href="/register" className="text-indigo-300 hover:underline">
            Register
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          Demo: REDACTED_EMAIL / ChangeMe123!
        </p>
      </CardContent>
    </Card>
  );
}
