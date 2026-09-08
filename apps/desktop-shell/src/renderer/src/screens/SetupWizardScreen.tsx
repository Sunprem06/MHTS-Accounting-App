import { useState } from 'react';

interface Props {
  companyName: string;
  onGoToInvoice: () => void;
  onSkipToDashboard: () => void;
}

type Step = 'welcome' | 'customer' | 'item' | 'ready';

/**
 * Shown exactly once, right after a brand-new company's first login — never
 * on a returning login (App.tsx only routes here when the login/recovery-key
 * chain started from CreateCompanyScreen). Chains together the same real
 * createParty/createItem calls the full Parties/Items screens use, just with
 * a smaller field set — the full screens remain the place to fill in
 * everything else afterward. Every step is skippable; this never blocks a
 * company that wants to set things up its own way instead.
 */
export function SetupWizardScreen({ companyName, onGoToInvoice, onSkipToDashboard }: Props) {
  const [step, setStep] = useState<Step>('welcome');

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      {step === 'welcome' && <WelcomeStep companyName={companyName} onStart={() => setStep('customer')} onSkip={onSkipToDashboard} />}
      {step === 'customer' && <CustomerStep onNext={() => setStep('item')} />}
      {step === 'item' && <ItemStep onNext={() => setStep('ready')} />}
      {step === 'ready' && <ReadyStep companyName={companyName} onGoToInvoice={onGoToInvoice} onSkip={onSkipToDashboard} />}
    </div>
  );
}

function WelcomeStep({ companyName, onStart, onSkip }: { companyName: string; onStart: () => void; onSkip: () => void }) {
  return (
    <>
      <h1>Welcome to {companyName}!</h1>
      <p>Let's get you to your first invoice — this only takes a minute. You can skip any step and do it later from the main menu.</p>
      <button type="button" onClick={onStart}>
        Get started
      </button>{' '}
      <button type="button" onClick={onSkip}>
        Skip setup
      </button>
    </>
  );
}

function CustomerStep({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createParty({
      partyType: 'CUSTOMER',
      name,
      gstin: gstin || undefined,
      stateCode: stateCode || undefined,
      isMsmeUdyamRegistered: false,
    });
    setSubmitting(false);
    if (result.ok) {
      onNext();
    } else {
      setError(result.error ?? 'Failed to add customer');
    }
  }

  return (
    <>
      <h1>Add your first customer</h1>
      <p>Just the basics for now — you can fill in the rest later from Parties.</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <form onSubmit={handleAdd}>
        <p>
          <label>
            Customer name*
            <br />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            GSTIN (optional)
            <br />
            <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            State code (optional)
            <br />
            <input type="text" value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="e.g. 33" />
          </label>
        </p>
        <button type="submit" disabled={submitting || !name.trim()}>
          Add customer &amp; continue
        </button>{' '}
        <button type="button" onClick={onNext}>
          Skip this step
        </button>
      </form>
    </>
  );
}

function ItemStep({ onNext }: { onNext: () => void }) {
  const [itemCode, setItemCode] = useState('');
  const [name, setName] = useState('');
  const [hsnSacCode, setHsnSacCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createItem({
      itemCode,
      name,
      itemType: 'SERVICE',
      hsnSacCode: hsnSacCode || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      onNext();
    } else {
      setError(result.error ?? 'Failed to add item');
    }
  }

  return (
    <>
      <h1>Add your first item or service</h1>
      <p>
        This quick-add creates a service item (no stock tracking). Selling a physical product? Set up units and warehouses
        from Inventory → Manage Items after finishing this quick setup, then add a stockable item there.
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <form onSubmit={handleAdd}>
        <p>
          <label>
            Item code*
            <br />
            <input type="text" value={itemCode} onChange={(e) => setItemCode(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Name*
            <br />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            HSN/SAC code (optional)
            <br />
            <input type="text" value={hsnSacCode} onChange={(e) => setHsnSacCode(e.target.value)} />
          </label>
        </p>
        <button type="submit" disabled={submitting || !itemCode.trim() || !name.trim()}>
          Add item &amp; continue
        </button>{' '}
        <button type="button" onClick={onNext}>
          Skip this step
        </button>
      </form>
    </>
  );
}

function ReadyStep({ companyName, onGoToInvoice, onSkip }: { companyName: string; onGoToInvoice: () => void; onSkip: () => void }) {
  return (
    <>
      <h1>You're all set!</h1>
      <p>{companyName} is ready to go. Let's create your first invoice.</p>
      <button type="button" onClick={onGoToInvoice}>
        Create my first invoice
      </button>{' '}
      <button type="button" onClick={onSkip}>
        Go to Dashboard instead
      </button>
    </>
  );
}
