const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateBypassCode(): string {
  const suffix = Array.from({ length: 4 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('');
  return `PR-${new Date().getFullYear()}-${suffix}`;
}

export function getStartOfDayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function getExpiryDate(hours: number = 48): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export interface BypassCodeRecord {
  id: string;
  code: string;
  email: string;
  created_by: string;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface BypassCodeValidation {
  valid: boolean;
  error?: string;
  codeRecord?: BypassCodeRecord;
}

export async function validateBypassCode(
  supabase: SupabaseClient,
  code: string,
  email: string
): Promise<BypassCodeValidation> {
  const { data: codeRecord, error } = await supabase
    .from('bypass_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !codeRecord) {
    return { valid: false, error: 'Invalid code' };
  }

  if (codeRecord.used_at) {
    return { valid: false, error: 'Code has already been used' };
  }

  if (new Date(codeRecord.expires_at) < new Date()) {
    return { valid: false, error: 'Code has expired' };
  }

  if (codeRecord.email.toLowerCase() !== email.toLowerCase()) {
    return { valid: false, error: 'Code does not match this email address' };
  }

  return { valid: true, codeRecord };
}

type SupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: BypassCodeRecord | null; error: unknown }>;
    };
  };
};
