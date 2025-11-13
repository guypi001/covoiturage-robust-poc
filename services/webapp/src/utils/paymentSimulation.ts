export type PaymentSimulationStepStatus = 'pending' | 'active' | 'done' | 'error';

export type PaymentSimulationStep = {
  id: string;
  label: string;
  status: PaymentSimulationStepStatus;
};

type StepTemplate = {
  id: string;
  label: string;
  duration: number;
};

const DEFAULT_STEPS: StepTemplate[] = [
  { id: 'loading', label: 'Chargement du paiement sécurisé…', duration: 900 },
  { id: 'validation', label: 'Validation auprès de la banque…', duration: 1200 },
];

export type PaymentSimulationUpdate = {
  index: number;
  steps: PaymentSimulationStep[];
};

export type StartPaymentSimulationOptions = {
  onUpdate?: (update: PaymentSimulationUpdate) => void;
  signal?: AbortSignal;
  steps?: StepTemplate[];
};

export type PaymentSimulationHandle = {
  promise: Promise<void>;
  cancel: () => void;
  getCurrentIndex: () => number;
  getSnapshot: () => PaymentSimulationStep[];
};

export function createInitialSimulationSteps(
  template: StepTemplate[] = DEFAULT_STEPS,
): PaymentSimulationStep[] {
  return template.map((step) => ({
    id: step.id,
    label: step.label,
    status: 'pending' as PaymentSimulationStepStatus,
  }));
}

export function startPaymentSimulation(
  options: StartPaymentSimulationOptions = {},
): PaymentSimulationHandle {
  const { onUpdate, signal, steps: template = DEFAULT_STEPS } = options;

  const state = {
    cancelled: false,
    timers: [] as ReturnType<typeof setTimeout>[],
    rejectors: [] as Array<() => void>,
  };

  let currentIndex = -1;
  let stepsSnapshot = createInitialSimulationSteps(template);

  const cleanup = () => {
    state.timers.forEach((timer) => clearTimeout(timer));
    state.timers = [];
    state.rejectors.forEach((rejector) => rejector());
    state.rejectors = [];
  };

  const cancel = () => {
    if (state.cancelled) return;
    state.cancelled = true;
    cleanup();
  };

  const removeTimer = (timer: ReturnType<typeof setTimeout>) => {
    state.timers = state.timers.filter((item) => item !== timer);
  };

  const removeRejector = (rejector: () => void) => {
    state.rejectors = state.rejectors.filter((item) => item !== rejector);
  };

  const delay = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (state.cancelled) {
        reject(new Error('cancelled'));
        return;
      }
      const timer = setTimeout(() => {
        removeTimer(timer);
        removeRejector(rejectWithCancel);
        if (state.cancelled) reject(new Error('cancelled'));
        else resolve();
      }, ms);

      const rejectWithCancel = () => {
        removeTimer(timer);
        removeRejector(rejectWithCancel);
        reject(new Error('cancelled'));
      };

      state.timers.push(timer);
      state.rejectors.push(rejectWithCancel);
    });

  if (signal) {
    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel);
  }

  onUpdate?.({ index: currentIndex, steps: stepsSnapshot });

  const promise = (async () => {
    for (let step = 0; step < template.length; step += 1) {
      if (state.cancelled) throw new Error('cancelled');
      currentIndex = step;
      stepsSnapshot = stepsSnapshot.map((item, idx) => {
        if (idx < step) return { ...item, status: 'done' };
        if (idx === step) return { ...item, status: 'active' };
        return { ...item, status: 'pending' };
      });
      onUpdate?.({ index: currentIndex, steps: stepsSnapshot });
      await delay(template[step].duration);
      if (state.cancelled) throw new Error('cancelled');
      stepsSnapshot = stepsSnapshot.map((item, idx) =>
        idx <= step ? { ...item, status: 'done' } : item,
      );
      onUpdate?.({ index: currentIndex, steps: stepsSnapshot });
    }
  })()
    .catch((err) => {
      if ((err as Error)?.message !== 'cancelled') throw err;
    })
    .finally(() => {
      if (signal) signal.removeEventListener('abort', cancel);
      cleanup();
    });

  return {
    promise,
    cancel,
    getCurrentIndex: () => currentIndex,
    getSnapshot: () => stepsSnapshot,
  };
}
