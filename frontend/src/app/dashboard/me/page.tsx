"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { selfServiceApi } from "@/lib/api";
import type { Employee } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToastStore } from "@/stores/toast-store";
import { Mail, MapPin, Pencil, Phone, Briefcase, Building2, UserRound } from "lucide-react";

// Self-service edits are limited to personal details. Department, position and
// email stay HR-managed and are shown read-only.
const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or fewer"),
  phone: z
    .string()
    .trim()
    .max(20, "Phone must be 20 characters or fewer")
    .refine(
      (value) => value === "" || /^\+?[0-9 ()\-]{7,}$/.test(value),
      "Enter a valid phone number (digits, spaces, parentheses or dashes)"
    ),
  location: z
    .string()
    .trim()
    .max(200, "Location must be 200 characters or fewer"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

function extractServerError(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: unknown } }).response;
    const data = response?.data as
      | { detail?: unknown; error?: unknown; message?: unknown }
      | undefined;
    const detail = data?.detail ?? data?.error ?? data?.message;
    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (typeof first?.msg === "string") return first.msg;
    }
  }
  return "Something went wrong. Please try again.";
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || "-"}</p>
      </div>
    </div>
  );
}

export default function MyProfilePage() {
  const addToast = useToastStore((s) => s.toast);
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      try {
        const { data } = await selfServiceApi.profile.get();
        return data as Employee;
      } catch (err) {
        // 404 means "no employee record linked to this account", which is an
        // empty state, not a loading failure.
        if (isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", phone: "", location: "" },
  });

  useEffect(() => {
    if (dialogOpen && profile) {
      reset({
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        location: profile.location ?? "",
      });
    }
  }, [dialogOpen, profile, reset]);

  const onSubmit = async (formData: ProfileFormData) => {
    setSaving(true);
    try {
      await selfServiceApi.profile.update({
        name: formData.name,
        phone: formData.phone || undefined,
        location: formData.location || undefined,
      });
      addToast({ title: "Profile updated", variant: "success" });
      setDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (err) {
      addToast({
        title: "Failed to update profile",
        description: extractServerError(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="my-profile-loading">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/50" data-testid="my-profile-error">
        <CardContent className="space-y-3 py-10 text-center">
          <p className="font-medium text-destructive">Failed to load your profile</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Something went wrong. Please try again."}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Retrying..." : "Retry"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card data-testid="my-profile-empty">
        <CardContent className="py-10 text-center text-muted-foreground">
          No employee profile is linked to your account yet. Contact your HR team.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="my-profile">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{profile.name}</CardTitle>
            <CardDescription>
              {profile.position} in {profile.department}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} data-testid="edit-profile">
            <Pencil className="h-4 w-4" /> Edit my details
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <DetailRow icon={UserRound} label="Full name" value={profile.name} />
          <DetailRow icon={Mail} label="Email" value={profile.email} />
          <DetailRow icon={Building2} label="Department" value={profile.department} />
          <DetailRow icon={Briefcase} label="Position" value={profile.position} />
          <DetailRow icon={Phone} label="Phone" value={profile.phone ?? ""} />
          <DetailRow icon={MapPin} label="Location" value={profile.location ?? ""} />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} data-testid="profile-form">
            <DialogHeader>
              <DialogTitle>Edit my details</DialogTitle>
              <DialogDescription>
                You can update your name, phone and location. Ask HR to change your
                department, position or email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1">
                <Label htmlFor="profile-name">Full name</Label>
                <Input id="profile-name" {...register("name")} aria-invalid={!!errors.name} />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="profile-phone">Phone</Label>
                <Input
                  id="profile-phone"
                  placeholder="+91 98765 43210"
                  {...register("phone")}
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="profile-location">Location</Label>
                <Input
                  id="profile-location"
                  placeholder="Bengaluru"
                  {...register("location")}
                  aria-invalid={!!errors.location}
                />
                {errors.location && (
                  <p className="text-xs text-destructive">{errors.location.message}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} data-testid="save-profile">
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
