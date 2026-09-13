/**
 * Lead monitoring — GetMonitoringByStgLeadNo (Postman v1.9).
 * Lebih lengkap dari GetPagingStageWebsiteLead: historis website → Confins.
 */

export type LeadTaskHistoryItem = {
  Name: string;
  IndicatorSLA: string | null;
  StartTime: string | null;
  EndTime: string | null;
  Assignee: string | null;
  Due: string | null;
  TrxNo: string | null;
};

export type LeadMonitoringResult = {
  LeadNo: string;
  CustConsentStatus: string;
  ListTaskHistory: LeadTaskHistoryItem[];
  /** Enrich dari DB lokal (endpoint monitoring tidak kirim nama/aset). */
  CustName?: string | null;
  VehicleSummary?: string | null;
  /**
   * LeadNo simulasi (PriceStep) yang dipakai user untuk pencarian,
   * jika berbeda dari LeadNo yang dipantau di MLoan/Confins.
   */
  SimulationLeadNo?: string | null;
  /** True jika histori mengandung task terminal reject. */
  HasRejectedTask?: boolean;
};

export type LocalLeadTrackingRef = {
  id: string;
  simulationLeadNo: string | null;
  hyundaiLeadNo: string | null;
  hyundaiAssignStatus: string;
  hyundaiGoLiveAt: Date | null;
  name: string | null;
  vehicleSummary: string | null;
};

export type ResolvedTrackingLead = {
  /** LeadNo yang dikirim ke GetMonitoringByStgLeadNo. */
  monitorLeadNo: string;
  simulationLeadNo: string | null;
  /** true = user input LeadNo simulasi, lalu diarahkan ke hyundaiLeadNo. */
  resolvedFromSimulation: boolean;
  /**
   * Lead lokal ketemu via simulationLeadNo, tapi belum SUBMITTED ke MLoan
   * (hyundaiLeadNo kosong / status belum SUBMITTED) — monitoring belum tersedia.
   */
  pendingSubmit: boolean;
};

/**
 * Resolve LeadNo input user → LeadNo yang valid untuk monitoring MLoan.
 *
 * Cross-office submit membuat LeadNo baru (`hyundaiLeadNo`) berbeda dari
 * LeadNo simulasi (`simulationLeadNo`). User sering hanya punya nomor simulasi
 * (ditampilkan di ResultStep) — harus diarahkan ke nomor submitted.
 */
export function resolveTrackingLeadNo(
  inputLeadNo: string,
  local: LocalLeadTrackingRef | null
): ResolvedTrackingLead {
  const input = inputLeadNo.trim().toUpperCase();
  if (!local) {
    return {
      monitorLeadNo: input,
      simulationLeadNo: null,
      resolvedFromSimulation: false,
      pendingSubmit: false,
    };
  }

  const sim = local.simulationLeadNo?.trim().toUpperCase() || null;
  const submitted = local.hyundaiLeadNo?.trim().toUpperCase() || null;
  const assignStatus = local.hyundaiAssignStatus?.trim().toUpperCase() || '';
  const isSubmittedStatus = assignStatus === 'SUBMITTED';

  const inputMatchesSim = sim != null && sim === input;
  const inputMatchesSubmitted = submitted != null && submitted === input;
  // Local ketemu via draft/simulasi: ada submitted yang beda dari input.
  const inputIsSimulationSide =
    inputMatchesSim || (submitted != null && submitted !== input && !inputMatchesSubmitted);

  // Input = nomor simulasi → selalu pakai nomor submitted bila sudah beda.
  if (inputIsSimulationSide) {
    if (submitted && submitted !== input) {
      return {
        monitorLeadNo: submitted,
        simulationLeadNo: sim || input,
        resolvedFromSimulation: true,
        pendingSubmit: false,
      };
    }

    return {
      monitorLeadNo: input,
      simulationLeadNo: sim || input,
      resolvedFromSimulation: false,
      pendingSubmit: !isSubmittedStatus || !submitted,
    };
  }

  // Input = LeadNo submitted (atau same-office: sim === submitted).
  if (inputMatchesSubmitted) {
    return {
      monitorLeadNo: submitted!,
      simulationLeadNo: sim && sim !== submitted ? sim : null,
      resolvedFromSimulation: false,
      pendingSubmit: false,
    };
  }

  return {
    monitorLeadNo: input,
    simulationLeadNo: sim && sim !== input ? sim : null,
    resolvedFromSimulation: false,
    pendingSubmit: false,
  };
}

/** @deprecated Prefer LeadMonitoringResult — disimpan untuk referensi response lama. */
export type WebsiteLeadStage = {
  LeadNo: string;
  ApprovalCode: string | null;
  CustName: string;
  AssetName: string;
  IdNo: string;
  LeadStepCode: string;
  LeadStepDescr: string;
  LeadStatCode: string;
  LeadStatDescr: string;
  CreatedDt: string;
  LastUpdDt: string;
  IsFromForward: boolean;
  IsTakenFromDealer: boolean;
  ChannelCode: string;
  UserInputName: string | null;
};

export function normalizeTaskHistory(raw: unknown): LeadTaskHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((row) => {
      const nameRaw = row.Name ?? row.TaskName ?? row.taskName ?? row.name;
      return {
        Name: String(nameRaw ?? '').trim(),
        IndicatorSLA:
          row.IndicatorSLA == null || row.IndicatorSLA === ''
            ? null
            : String(row.IndicatorSLA),
        StartTime:
          row.StartTime == null || row.StartTime === ''
            ? null
            : String(row.StartTime),
        EndTime:
          row.EndTime == null || row.EndTime === '' ? null : String(row.EndTime),
        Assignee:
          row.Assignee == null || row.Assignee === '' ? null : String(row.Assignee),
        Due: row.Due == null || row.Due === '' ? null : String(row.Due),
        TrxNo: row.TrxNo == null || row.TrxNo === '' ? null : String(row.TrxNo),
      };
    })
    .filter((row) => row.Name.length > 0);
}

/** Chronological: oldest first (timeline top → bottom). */
export function sortTaskHistory(
  items: LeadTaskHistoryItem[]
): LeadTaskHistoryItem[] {
  return [...items].sort((a, b) => {
    const ta = a.StartTime ? Date.parse(a.StartTime) : Number.NaN;
    const tb = b.StartTime ? Date.parse(b.StartTime) : Number.NaN;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });
}

export function consentStatusTone(status: string): string {
  const code = status.trim().toUpperCase();
  if (!code) return 'bg-slate-50 text-slate-800 border-slate-200';
  if (code === 'SCS' || code.includes('SUCCESS') || code.includes('APPROV')) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (code.includes('REJ') || code.includes('FAIL') || code.includes('CANCEL')) {
    return 'bg-red-50 text-red-800 border-red-200';
  }
  if (code.includes('PEND') || code.includes('WAIT') || code.includes('PROG')) {
    return 'bg-amber-50 text-amber-900 border-amber-200';
  }
  return 'bg-slate-50 text-slate-800 border-slate-200';
}
