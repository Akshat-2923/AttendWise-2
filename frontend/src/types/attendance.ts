export interface SubjectAttendance {
  code: string;
  subject: string;
  conducted: number;
  attended: number;
  percentage: number;
  bunk_budget: number;
  recovery_classes: number;
  status: string;
  medical_leave?: number;
  duty_leave?: number;
  recovery_date?: string;
  recovery_days_away?: number;
}
