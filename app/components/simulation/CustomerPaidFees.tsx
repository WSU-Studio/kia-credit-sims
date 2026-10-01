'use client';

import { FeeStepper } from '@/app/components/simulation/FeeStepper';
import {
  ADMIN_FEE_STEP_AMT,
  PROVISION_FEE_STEP_PRCNT,
  stepValue,
  type SalesmanFeeCaps,
} from '@/lib/salesman-fee';

type CustomerPaidFeesProps = {
  editable: boolean;
  adminFeeAmt: number;
  provisionPrcnt: number;
  provisionAmt: number;
  showProvision: boolean;
  caps: SalesmanFeeCaps;
  adminFeeMin?: number;
  adminFeeMax?: number;
  adminFeeLocked?: boolean;
  provisionLocked?: boolean;
  disabled?: boolean;
  onAdminFeeChange: (next: number) => void;
  onProvisionPrcntChange: (next: number) => void;
  formatCurrency: (n: number) => string;
  labels: {
    sectionTitle: string;
    adminFee: string;
    adminFeeHint: string;
    provision: string;
    provisionHint: string;
    provisionAmount: string;
  };
};

export function CustomerPaidFees({
  editable,
  adminFeeAmt,
  provisionPrcnt,
  provisionAmt,
  showProvision,
  caps,
  adminFeeMin = 0,
  adminFeeMax = caps.maxAdminFeeAmt,
  adminFeeLocked = false,
  provisionLocked = false,
  disabled,
  onAdminFeeChange,
  onProvisionPrcntChange,
  formatCurrency,
  labels,
}: CustomerPaidFeesProps) {
  if (!editable) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-800">{labels.sectionTitle}</h3>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{labels.adminFee}</span>
          <span className="font-semibold text-gray-900">{formatCurrency(adminFeeAmt)}</span>
        </div>
        {showProvision ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{labels.provision}</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(provisionAmt)} ({provisionPrcnt}%)
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">{labels.sectionTitle}</h3>
      <FeeStepper
        id="salesman-admin-fee"
        label={labels.adminFee}
        hint={labels.adminFeeHint}
        valueLabel={formatCurrency(adminFeeAmt)}
        disabled={disabled || adminFeeLocked}
        decrementDisabled={adminFeeLocked || adminFeeAmt <= adminFeeMin}
        incrementDisabled={adminFeeLocked || adminFeeAmt >= adminFeeMax}
        onDecrement={() =>
          onAdminFeeChange(
            stepValue(adminFeeAmt, -1, ADMIN_FEE_STEP_AMT, adminFeeMin, adminFeeMax)
          )
        }
        onIncrement={() =>
          onAdminFeeChange(
            stepValue(adminFeeAmt, 1, ADMIN_FEE_STEP_AMT, adminFeeMin, adminFeeMax)
          )
        }
      />
      {showProvision ? (
        <div className="space-y-1">
          <FeeStepper
            id="salesman-provision-fee"
            label={labels.provision}
            hint={labels.provisionHint}
            valueLabel={`${provisionPrcnt}%`}
            disabled={disabled || provisionLocked}
            decrementDisabled={provisionLocked || provisionPrcnt <= 0}
            incrementDisabled={provisionLocked || provisionPrcnt >= caps.maxProvisionPrcnt}
            onDecrement={() => {
              if (provisionLocked) return;
              onProvisionPrcntChange(
                stepValue(provisionPrcnt, -1, PROVISION_FEE_STEP_PRCNT, 0, caps.maxProvisionPrcnt)
              );
            }}
            onIncrement={() => {
              if (provisionLocked) return;
              onProvisionPrcntChange(
                stepValue(provisionPrcnt, 1, PROVISION_FEE_STEP_PRCNT, 0, caps.maxProvisionPrcnt)
              );
            }}
          />
          <p className="text-xs text-gray-500">
            {labels.provisionAmount}: {formatCurrency(provisionAmt)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
