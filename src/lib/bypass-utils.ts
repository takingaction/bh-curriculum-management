const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateBypassCode(): string {
  const suffix = Array.from({ length: 4 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('');
  return `PR-${new Date().getFullYear()}-${suffix}`;
}

export function generateUniversalToken(): string {
  return generateBypassCode();
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

export interface UniversalTokenRecord {
  id: string;
  token: string;
  created_at: string;
  created_by: string;
}

export interface BypassCodeValidation {
  valid: boolean;
  error?: string;
  codeRecord?: BypassCodeRecord;
}

export interface UniversalTokenValidation {
  valid: boolean;
  error?: string;
}

export async function validateBypassCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
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

export async function validateUniversalToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  code: string,
  email: string
): Promise<UniversalTokenValidation> {
  const { data: universalToken, error } = await supabase
    .from('universal_tokens')
    .select('*')
    .eq('token', code.toUpperCase())
    .single();

  if (error || !universalToken) {
    return { valid: false, error: 'Invalid universal token' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (profileError || !profile) {
    return { valid: false, error: 'No account found with this email address' };
  }

  return { valid: true };
}
