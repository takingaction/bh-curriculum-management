import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface CSVRow {
  first_name: string;
  last_name: string;
  email: string;
  primary_discipline: string;
  enrollments: string;
  district: string;
  active_status: string;
}

function parseEnrollments(enrollmentsStr: string): string[] {
  if (!enrollmentsStr || enrollmentsStr.trim() === '') {
    return ['ALL'];
  }
  
  const values = enrollmentsStr.split(';').map(s => s.trim()).filter(Boolean);
  
  if (values.length === 0) {
    return ['ALL'];
  }
  
  return values.map(v => {
    const upper = v.toUpperCase();
    if (upper === 'ALL') return 'ALL';
    if (['MUSIC', 'THEATRE', 'DANCE'].includes(upper)) return upper;
    
    const gradeMatch = v.match(/^(MUSIC|THEATRE|DANCE)[_\s-]*GRADE[_\s-]*(.+)$/i);
    if (gradeMatch) {
      const discipline = gradeMatch[1].toUpperCase();
      let grade = gradeMatch[2].toUpperCase().trim();
      if (grade === 'K') grade = 'K';
      return `${discipline}_GRADE_${grade}`;
    }
    
    return v;
  });
}

function parseActiveStatus(status: string): string {
  if (!status || status.trim() === '') return 'trial';
  
  const upper = status.toLowerCase().trim();
  if (['yes', 'true', '1', 'active'].includes(upper)) return 'active';
  if (['no', 'false', '0', 'inactive'].includes(upper)) return 'inactive';
  return 'trial';
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { csvData } = body;

    if (!csvData || !Array.isArray(csvData)) {
      return NextResponse.json(
        { error: "csvData is required and must be an array" },
        { status: 400 }
      );
    }

    const validDisciplines = ['N/A', 'MUSIC', 'THEATRE', 'DANCE'];
    const results: { success: boolean; row: number; email: string; error?: string }[] = [];

    for (let i = 0; i < csvData.length; i++) {
      const row: CSVRow = csvData[i];
      const rowNum = i + 2;

      if (!row.first_name || !row.last_name || !row.email) {
        results.push({
          success: false,
          row: rowNum,
          email: row.email || 'N/A',
          error: "Missing required fields (first_name, last_name, email)"
        });
        continue;
      }

      const email = row.email.toLowerCase().trim();

      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (existing) {
        results.push({
          success: false,
          row: rowNum,
          email,
          error: "Email already exists"
        });
        continue;
      }

      const primaryDiscipline = row.primary_discipline?.toUpperCase().trim();
      if (primaryDiscipline && !validDisciplines.includes(primaryDiscipline)) {
        results.push({
          success: false,
          row: rowNum,
          email,
          error: `Invalid primary_discipline: ${row.primary_discipline}`
        });
        continue;
      }

      const enrollmentStatus = parseActiveStatus(row.active_status);
      const enrollments = parseEnrollments(row.enrollments);

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          first_name: row.first_name,
          last_name: row.last_name,
        }
      });

      if (authError) {
        results.push({
          success: false,
          row: rowNum,
          email,
          error: `Auth error: ${authError.message}`
        });
        continue;
      }

      if (!authData?.user) {
        results.push({
          success: false,
          row: rowNum,
          email,
          error: "Failed to create auth user"
        });
        continue;
      }

      const trialStartsAt = enrollmentStatus === 'trial' ? new Date().toISOString() : null;
      const trialEndsAt = enrollmentStatus === 'trial' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null;

      // Profile already exists due to handle_new_user trigger, so UPDATE instead of INSERT
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          email,
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          role: "teacher",
          california: true,
          district_name: row.district?.trim() || null,
          primary_discipline: primaryDiscipline || 'N/A',
          enrollment_status: enrollmentStatus,
          enrollments,
          trial_starts_at: trialStartsAt,
          trial_ends_at: trialEndsAt,
        })
        .eq("id", authData.user.id);

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        results.push({
          success: false,
          row: rowNum,
          email,
          error: `Profile error: ${profileError.message}`
        });
        continue;
      }

      results.push({
        success: true,
        row: rowNum,
        email,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      total: csvData.length,
      imported: successCount,
      failed: failCount,
      results
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
