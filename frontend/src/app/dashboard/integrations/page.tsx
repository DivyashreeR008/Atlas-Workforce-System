"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cable,
  Plus,
  Trash2,
  RefreshCw,
  Webhook,
  Radio,
  Box,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { integrationApi } from "@/lib/api";
import type {
  IntegrationWebhook,
  IntegrationEventSubscription,
  IntegrationDashboard,
} from "@/types";

const tabs = [
  { id: "overview", label: "Overview", icon: Cable },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "subscriptions", label: "Subscriptions", icon: Radio },
  { id: "outbox", label: "Event Outbox", icon: Box },
  { id: "config", label: "Config", icon: Settings },
];

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [showCreateSubscription, setShowCreateSubscription] = useState(false);
  const queryClient = useQueryClient();

  const { data: dashboard } = useQuery<IntegrationDashboard>({
    queryKey: ["integration-dashboard"],
    queryFn: () => integrationApi.dashboard().then((r) => r.data),
  });

  const { data: webhooks, isLoading: webhooksLoading } = useQuery({
    queryKey: ["integration-webhooks"],
    queryFn: () => integrationApi.webhooks.list({ page_size: 50 }).then((r) => r.data),
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["integration-subscriptions"],
    queryFn: () => integrationApi.subscriptions.list({ page_size: 50 }).then((r) => r.data),
  });

  const { data: outbox } = useQuery({
    queryKey: ["integration-outbox"],
    queryFn: () => integrationApi.outbox.list({ page_size: 50 }).then((r) => r.data),
  });

  const { data: configs } = useQuery({
    queryKey: ["integration-configs"],
    queryFn: () => integrationApi.config.list().then((r) => r.data),
  });

  const deleteWebhook = useMutation({
    mutationFn: (id: string) => integrationApi.webhooks.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration-webhooks"] }),
  });

  const deleteSubscription = useMutation({
    mutationFn: (id: string) => integrationApi.subscriptions.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration-subscriptions"] }),
  });

  function card(label: string, value: number | string, icon: React.ReactNode, color: string) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${color}`}>{icon}</div>
          <div>
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="text-sm text-gray-400">
            Webhook engine, event subscriptions, and Kafka event bridge
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {card("Total Webhooks", dashboard?.total_webhooks ?? 0, <Webhook className="h-5 w-5 text-blue-400" />, "bg-blue-500/20")}
            {card("Active Webhooks", dashboard?.active_webhooks ?? 0, <CheckCircle2 className="h-5 w-5 text-green-400" />, "bg-green-500/20")}
            {card("Subscriptions", dashboard?.total_subscriptions ?? 0, <Radio className="h-5 w-5 text-purple-400" />, "bg-purple-500/20")}
            {card("Total Deliveries", dashboard?.total_deliveries ?? 0, <RefreshCw className="h-5 w-5 text-cyan-400" />, "bg-cyan-500/20")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {card("Successful", dashboard?.successful_deliveries ?? 0, <CheckCircle2 className="h-5 w-5 text-green-400" />, "bg-green-500/20")}
            {card("Failed", dashboard?.failed_deliveries ?? 0, <XCircle className="h-5 w-5 text-red-400" />, "bg-red-500/20")}
            {card("Pending", dashboard?.pending_deliveries ?? 0, <Clock className="h-5 w-5 text-yellow-400" />, "bg-yellow-500/20")}
            {card("Outbox Pending", dashboard?.outbox_pending ?? 0, <Clock className="h-5 w-5 text-orange-400" />, "bg-orange-500/20")}
            {card("Outbox Failed", dashboard?.outbox_failed ?? 0, <AlertTriangle className="h-5 w-5 text-red-400" />, "bg-red-500/20")}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
            <h3 className="mb-4 text-lg font-semibold text-white">Architecture</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>Internal services publish events → <span className="text-indigo-400">RabbitMQ</span> (fanout exchange)</p>
              <p>Integration Service consumes → routes to <span className="text-blue-400">Webhooks</span> + <span className="text-purple-400">Kafka Topics</span></p>
              <p>Webhooks deliver via HTTP POST with retry + HMAC signatures</p>
              <p>Kafka topics expose events for external streaming consumers</p>
              <p>Event Outbox ensures reliable at-least-once delivery</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "webhooks" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateWebhook(!showCreateWebhook)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add Webhook
            </button>
          </div>

          {showCreateWebhook && (
            <WebhookForm
              onClose={() => setShowCreateWebhook(false)}
              onCreated={() => {
                setShowCreateWebhook(false);
                queryClient.invalidateQueries({ queryKey: ["integration-webhooks"] });
              }}
            />
          )}

          <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="p-3">Name</th>
                  <th className="p-3">URL</th>
                  <th className="p-3">Events</th>
                  <th className="p-3">Retry</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(webhooks?.items ?? []).map((wh: IntegrationWebhook) => (
                  <tr key={wh.id} className="border-b border-white/5 text-gray-300 hover:bg-white/5">
                    <td className="p-3 font-medium text-white">{wh.name}</td>
                    <td className="max-w-[200px] truncate p-3">{wh.url}</td>
                    <td className="p-3">{(wh.event_types ?? []).join(", ") || "*"}</td>
                    <td className="p-3">{wh.retry_count}x</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${wh.enabled ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                        {wh.enabled ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => deleteWebhook.mutate(wh.id)}
                        className="rounded p-1 text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {(webhooks?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      No webhooks configured. Create one to receive event deliveries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateSubscription(!showCreateSubscription)}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" /> Add Subscription
            </button>
          </div>

          {showCreateSubscription && (
            <SubscriptionForm
              onClose={() => setShowCreateSubscription(false)}
              onCreated={() => {
                setShowCreateSubscription(false);
                queryClient.invalidateQueries({ queryKey: ["integration-subscriptions"] });
              }}
            />
          )}

          <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Kafka Topic</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(subscriptions?.items ?? []).map((sub: IntegrationEventSubscription) => (
                  <tr key={sub.id} className="border-b border-white/5 text-gray-300 hover:bg-white/5">
                    <td className="p-3 font-medium text-white">{sub.event_type}</td>
                    <td className="p-3">{sub.source_service || "—"}</td>
                    <td className="p-3">
                      {sub.kafka_topic ? (
                        <code className="rounded bg-gray-800 px-2 py-0.5 text-xs text-purple-400">{sub.kafka_topic}</code>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${sub.enabled ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                        {sub.enabled ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => deleteSubscription.mutate(sub.id)}
                        className="rounded p-1 text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {(subscriptions?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">
                      No event subscriptions configured. Subscribe events to Kafka topics.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "outbox" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
            <h3 className="mb-3 text-sm font-medium text-gray-400">Event Outbox</h3>
            <p className="mb-4 text-sm text-gray-500">
              Reliable at-least-once event delivery via the transactional outbox pattern.
              Events are persisted and retried until acknowledged by the target system.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Retries</th>
                  <th className="p-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {(outbox?.items ?? []).map((event: { id: string; event_type: string; source_service: string; status: string; retry_count: number; created_at: string }) => (
                  <tr key={event.id} className="border-b border-white/5 text-gray-300 hover:bg-white/5">
                    <td className="p-3 font-medium text-white">{event.event_type}</td>
                    <td className="p-3">{event.source_service}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        event.status === "PUBLISHED" ? "bg-green-500/20 text-green-400" :
                        event.status === "FAILED" ? "bg-red-500/20 text-red-400" :
                        "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="p-3">{event.retry_count}</td>
                    <td className="p-3 text-xs text-gray-500">
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {(outbox?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">
                      No outbox events.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "config" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="p-3">Key</th>
                  <th className="p-3">Value</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {(configs ?? []).map((cfg: { key: string; value: unknown; description: string | null; updated_at: string }) => (
                  <tr key={cfg.key} className="border-b border-white/5 text-gray-300 hover:bg-white/5">
                    <td className="p-3 font-medium text-white">{cfg.key}</td>
                    <td className="p-3">
                      <code className="rounded bg-gray-800 px-2 py-0.5 text-xs text-cyan-400">
                        {typeof cfg.value === "object" ? JSON.stringify(cfg.value) : String(cfg.value)}
                      </code>
                    </td>
                    <td className="p-3 text-gray-500">{cfg.description || "—"}</td>
                    <td className="p-3 text-xs text-gray-500">
                      {new Date(cfg.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {(configs ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-500">
                      No integration config entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function WebhookForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [eventTypes, setEventTypes] = useState("");
  const [retryCount, setRetryCount] = useState("3");
  const [timeoutSec, setTimeoutSec] = useState("30");
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      integrationApi.webhooks.create({
        name,
        url,
        event_types: eventTypes.split(",").map((s) => s.trim()).filter(Boolean),
        retry_count: parseInt(retryCount) || 3,
        timeout_sec: parseInt(timeoutSec) || 30,
      }),
    onSuccess: onCreated,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/80 p-6 backdrop-blur-md">
      <h3 className="mb-4 text-lg font-semibold text-white">New Webhook</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-gray-400">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
            placeholder="Slack Notifications"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400">URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
            placeholder="https://hooks.slack.com/..."
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400">Event Types (comma-separated, * for all)</label>
          <input
            value={eventTypes}
            onChange={(e) => setEventTypes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
            placeholder="employee.created, candidate.hired"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-400">Retry Count</label>
            <input
              type="number"
              value={retryCount}
              onChange={(e) => setRetryCount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
              min={0}
              max={10}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-400">Timeout (sec)</label>
            <input
              type="number"
              value={timeoutSec}
              onChange={(e) => setTimeoutSec(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
              min={5}
              max={120}
            />
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => create.mutate()}
          disabled={!name || !url || create.isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {create.isPending ? "Creating..." : "Create Webhook"}
        </button>
        <button onClick={onClose} className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">
          Cancel
        </button>
      </div>
    </div>
  );
}

function SubscriptionForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [eventType, setEventType] = useState("");
  const [kafkaTopic, setKafkaTopic] = useState("");
  const [sourceService, setSourceService] = useState("");
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      integrationApi.subscriptions.create({
        event_type: eventType,
        kafka_topic: kafkaTopic || undefined,
        source_service: sourceService || undefined,
      }),
    onSuccess: onCreated,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/80 p-6 backdrop-blur-md">
      <h3 className="mb-4 text-lg font-semibold text-white">New Event Subscription</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-gray-400">Event Type</label>
          <input
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
            placeholder="employee.created"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400">Kafka Topic</label>
          <input
            value={kafkaTopic}
            onChange={(e) => setKafkaTopic(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
            placeholder="atlas.employees"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400">Source Service (optional)</label>
          <input
            value={sourceService}
            onChange={(e) => setSourceService(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
            placeholder="employee-service"
          />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => create.mutate()}
          disabled={!eventType || create.isPending}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {create.isPending ? "Creating..." : "Create Subscription"}
        </button>
        <button onClick={onClose} className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">
          Cancel
        </button>
      </div>
    </div>
  );
}
