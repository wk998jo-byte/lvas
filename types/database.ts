export type UserRole =
  | "manager_requester"
  | "supervisor_requester"
  | "other_employee"
  | "admin";

export type AuthorizationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export type NotificationType =
  | "expiry_warning"
  | "request_submitted"
  | "request_approved"
  | "request_rejected";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Employee = {
  id: string;
  badge: string;
  full_name: string;
  national_id: string | null;
  mobile: string | null;
  department: string | null;
  position: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Vehicle = {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Authorization = {
  id: string;
  vehicle_id: string;
  requester_id: string | null;
  employee_id: string | null;
  public_token: string;
  contact_mobile: string | null;
  approver_id: string | null;
  status: AuthorizationStatus;
  start_date: string;
  end_date: string;
  duration_label: string;
  usage_after: string;
  purpose: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  authorization_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  scheduled_for: string | null;
  sent_at: string | null;
  dedupe_key: string | null;
  created_at: string;
};
