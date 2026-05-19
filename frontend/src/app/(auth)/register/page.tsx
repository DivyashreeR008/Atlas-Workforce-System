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
  name: z.string().min(2, "Name required"),
  email: z.string().email("Valid email required"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "Include uppercase")
    .regex(/[0-9]/, "Include a number"),
  department: z.string().optional(),
  position: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await registerUser(data);
      toast({ title: "Account created", description: "Welcome to Atlas." });
      router.push("/dashboard");
    } catch {
      toast({
        title: "Registration failed",
        description: "Could not create account. Email may already exist.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-white/10 bg-white/5 text-white shadow-2xl backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Create account</CardTitle>
        <CardDescription className="text-slate-300">
          Join your organization on Atlas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-200">Full name</Label>
            <Input id="name" className="border-white/20 bg-white/10 text-white" {...register("name")} />
            {errors.name && <p className="text-sm text-red-400">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">Email</Label>
            <Input id="email" type="email" className="border-white/20 bg-white/10 text-white" {...register("email")} />
            {errors.email && <p className="text-sm text-red-400">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">Password</Label>
            <Input id="password" type="password" className="border-white/20 bg-white/10 text-white" {...register("password")} />
            {errors.password && <p className="text-sm text-red-400">{errors.password.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="department" className="text-slate-200">Department</Label>
              <Input id="department" className="border-white/20 bg-white/10 text-white" {...register("department")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position" className="text-slate-200">Position</Label>
              <Input id="position" className="border-white/20 bg-white/10 text-white" {...register("position")} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-300 hover:underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}
