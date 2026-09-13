import { prisma } from '@/lib/prisma';
import { hyundaiPost } from '@/lib/hyundai-api-post';
import {
  normalizeTaskHistory,
  sortTaskHistory,
  type LeadTaskHistoryItem,
} from '@/lib/lead-tracking';
import { collapseTaskHistoryToStages } from '@/lib/lead-tracking-stages';

const CONTRACT_ACTIVATION_STAGE = 'Contract Activation';

type MonitoringEnvelope = {
  ListTaskHistory?: unknown;
};

export const GO_LIVE_SYNC_BATCH_MAX = 10;

export function hasCompletedContractActivation(
  tasks: Array<{ Name: string; StartTime?: string | null; EndTime?: string | null }>
): boolean {
  const stages = collapseTaskHistoryToStages(tasks);
  return stages.some((stage) => stage.id === CONTRACT_ACTIVATION_STAGE && stage.status === 'completed');
}

export async function stampHyundaiGoLiveIfReached(opts: {
  leadId: string;
  hyundaiGoLiveAt: Date | null | undefined;
  tasks: LeadTaskHistoryItem[];
}): Promise<boolean> {
  if (!opts.leadId || opts.hyundaiGoLiveAt) return false;
  if (!hasCompletedContractActivation(opts.tasks)) return false;

  const result = await prisma.lead.updateMany({
    where: { id: opts.leadId, hyundaiGoLiveAt: null },
    data: { hyundaiGoLiveAt: new Date() },
  });
  return result.count > 0;
}

export async function fetchMonitoringTasks(leadNo: string): Promise<LeadTaskHistoryItem[]> {
  const envelope = await hyundaiPost<MonitoringEnvelope>(
    '/v1/IntegrationWebsite/GetMonitoringByStgLeadNo',
    { LeadNo: leadNo }
  );
  return sortTaskHistory(normalizeTaskHistory(envelope.ListTaskHistory));
}

export async function syncSubmittedLeadsGoLive(
  limit = GO_LIVE_SYNC_BATCH_MAX
): Promise<{ checked: number; stamped: number; errors: number }> {
  const take = Math.min(Math.max(1, limit), GO_LIVE_SYNC_BATCH_MAX);
  const leads = await prisma.lead.findMany({
    where: {
      hyundaiAssignStatus: 'SUBMITTED',
      hyundaiLeadNo: { not: null },
      hyundaiGoLiveAt: null,
    },
    select: { id: true, hyundaiLeadNo: true },
    orderBy: { hyundaiAssignedAt: 'desc' },
    take,
  });

  let stamped = 0;
  let errors = 0;
  for (const lead of leads) {
    const leadNo = lead.hyundaiLeadNo?.trim();
    if (!leadNo) continue;
    try {
      const tasks = await fetchMonitoringTasks(leadNo);
      if (await stampHyundaiGoLiveIfReached({ leadId: lead.id, hyundaiGoLiveAt: null, tasks })) {
        stamped += 1;
      }
    } catch {
      errors += 1;
    }
  }

  return { checked: leads.length, stamped, errors };
}
