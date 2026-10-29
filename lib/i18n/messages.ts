import type { Locale } from "@/lib/i18n/config";

/**
 * Server actions, zod schemas and the gate check return English messages.
 * The UI passes them through here so Arabic users see Arabic text. Unknown
 * messages fall back to the English original.
 */
const EXACT_AR: Record<string, string> = {
  // lib/validations
  "Choose whether you need extended time": "اختر هل تحتاج وقتًا إضافيًا",
  "Plate number is too long": "رقم اللوحة طويل جدًا",
  "Year must be between 1980 and 2100": "يجب أن تكون سنة الصنع بين 1980 و2100",
  "Door Number is too long": "رقم الباب طويل جدًا",
  "Make is required": "الشركة المصنّعة مطلوبة",
  "Model is required": "الطراز مطلوب",
  "Invalid vehicle id": "معرّف المركبة غير صالح",
  "Select a vehicle": "اختر مركبة",
  "Start date is required": "تاريخ البداية مطلوب",
  "End date is required": "تاريخ النهاية مطلوب",
  "Duration is required": "المدة مطلوبة",
  "End date must be on or after start date": "يجب أن يكون تاريخ النهاية في يوم البداية أو بعده",
  "Enter at least 3 characters": "أدخل 3 أحرف على الأقل",
  "Select your name from the list": "اختر اسمك من القائمة",
  "Enter the last 4 digits of your ID": "أدخل آخر 4 أرقام من هويتك",
  "Enter a valid mobile number": "أدخل رقم جوال صحيحًا",
  "Select your project location": "اختر موقع مشروعك",
  "Enter a justification of at least 10 characters": "أدخل مبررًا لا يقل عن 10 أحرف",
  "Justification is too long": "المبرر طويل جدًا",
  "Invalid tracking link": "رابط المتابعة غير صالح",
  "Enter your badge number": "أدخل رقمك الوظيفي",
  "Badge number is too long": "الرقم الوظيفي طويل جدًا",
  "Enter a valid email": "أدخل بريدًا إلكترونيًا صحيحًا",
  "This reset link is invalid": "رابط إعادة التعيين غير صالح",
  "Use at least 8 characters": "استخدم 8 أحرف على الأقل",
  "Password is too long": "كلمة المرور طويلة جدًا",
  "Confirm your new password": "أكّد كلمة المرور الجديدة",
  "New passwords do not match": "كلمتا المرور الجديدتان غير متطابقتين",
  "Enter your current password": "أدخل كلمة المرور الحالية",
  "Invalid authorization id": "معرّف التصريح غير صالح",
  "Rejection reason is required": "سبب الرفض مطلوب",
  "Rejection reason is too long": "سبب الرفض طويل جدًا",
  "Invalid user id": "معرّف المستخدم غير صالح",
  // zod built-in defaults
  "Invalid email address": "عنوان البريد الإلكتروني غير صالح",
  "Invalid input": "مدخلات غير صالحة",
  "Invalid UUID": "معرّف غير صالح",

  // actions/vehicles
  "A vehicle with this Door Number already exists": "توجد مركبة مسجلة بنفس رقم الباب",
  "A vehicle with this plate number already exists": "توجد مركبة مسجلة بنفس رقم اللوحة",
  "Invalid vehicle data": "بيانات المركبة غير صالحة",
  "Vehicle not found": "المركبة غير موجودة",
  "Failed to create vehicle": "تعذّر إنشاء المركبة",
  "Database error": "خطأ في قاعدة البيانات",
  "Unknown error": "خطأ غير معروف",

  // actions/approvals
  "Only pending requests can be approved": "لا يمكن اعتماد إلا الطلبات قيد الانتظار",
  "This request is already with the final approver.": "هذا الطلب لدى المعتمد النهائي بالفعل.",
  "This request is outside your project locations.": "هذا الطلب خارج مواقع المشاريع المسندة إليك.",
  "Only a first-stage request can be approved": "لا يمكن اعتماد إلا طلب في المرحلة الأولى",
  "Logistics approval is still required.": "لا تزال موافقة اللوجستيات مطلوبة.",
  "Vehicle has an active authorization for overlapping dates.": "لدى المركبة تصريح نشط في تواريخ متداخلة.",
  "Unable to approve this request. Please try again.": "تعذّر اعتماد هذا الطلب. يرجى المحاولة مرة أخرى.",
  "Invalid rejection data": "بيانات الرفض غير صالحة",
  "Only pending requests can be rejected": "لا يمكن رفض إلا الطلبات قيد الانتظار",
  "Unable to reject this request. Please try again.": "تعذّر رفض هذا الطلب. يرجى المحاولة مرة أخرى.",
  "Only an approved authorization can be ended.": "لا يمكن إنهاء إلا تصريح معتمد.",

  // actions/auth
  "Email and password are required.": "البريد الإلكتروني وكلمة المرور مطلوبان.",
  "Invalid email or password.": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "This portal is for administrators and logistics approvers. Employees submit a request at /request — no sign-in needed.":
    "هذه البوابة مخصصة لمسؤولي النظام ومعتمدي اللوجستيات. يقدّم الموظفون طلباتهم عبر الصفحة /request دون الحاجة إلى تسجيل الدخول.",
  "Sign in again to change your password.": "سجّل الدخول مرة أخرى لتغيير كلمة المرور.",
  "Invalid password": "كلمة المرور غير صالحة",
  "Choose a password that is different from the current one.": "اختر كلمة مرور مختلفة عن كلمة المرور الحالية.",
  "Current password is incorrect.": "كلمة المرور الحالية غير صحيحة.",
  "Could not change the password.": "تعذّر تغيير كلمة المرور.",
  "Invalid reset": "طلب إعادة التعيين غير صالح",
  "This reset link is invalid or has expired.": "رابط إعادة التعيين غير صالح أو منتهي الصلاحية.",
  "Sign-out failed.": "تعذّر تسجيل الخروج.",
  "Password reset email is not configured.": "بريد إعادة تعيين كلمة المرور غير مهيأ.",

  // lib/security/rate-limit
  "Too many attempts. Please try again later.": "محاولات كثيرة جدًا. يرجى المحاولة لاحقًا.",
  "Unable to process your request. Please try again later.": "تعذّرت معالجة طلبك. يرجى المحاولة لاحقًا.",

  // lib/approvals/final-approvers
  "Final approval is not configured for this location. Contact the fleet administrator.":
    "الموافقة النهائية غير مهيأة لهذا الموقع. تواصل مع مسؤول الأسطول.",
  "Final approval is not configured for this request. Contact the fleet administrator.":
    "الموافقة النهائية غير مهيأة لهذا الطلب. تواصل مع مسؤول الأسطول.",
  "You are not assigned as the final approver for this request.": "لست المعتمد النهائي المكلّف بهذا الطلب.",

  // actions/public-requests
  "Invalid search": "بحث غير صالح",
  "Invalid verification": "بيانات التحقق غير صالحة",
  "Employee details and ID digits do not match.": "بيانات الموظف وأرقام الهوية غير متطابقة.",
  "Invalid request data": "بيانات الطلب غير صالحة",
  "Start date cannot be before today.": "لا يمكن أن يكون تاريخ البداية قبل اليوم.",
  "No logistics approver is configured for this location. Contact the fleet administrator.":
    "لا يوجد معتمد لوجستيات مهيأ لهذا الموقع. تواصل مع مسؤول الأسطول.",
  "Selected vehicle is not available": "المركبة المختارة غير متاحة",
  "Vehicle has an active authorization for those dates. Choose different dates or another vehicle.":
    "لدى المركبة تصريح نشط في هذه التواريخ. اختر تواريخ مختلفة أو مركبة أخرى.",
  "Invalid lookup": "بيانات الاستعلام غير صالحة",
  "Failed to create authorization": "تعذّر إنشاء التصريح",
  "Unable to resolve the Saudi business date.": "تعذّر تحديد تاريخ العمل بتوقيت السعودية.",

  // lib/authorizations/gate-verification + gate-lookup
  "Authorization not found / invalid QR.": "التصريح غير موجود / رمز QR غير صالح.",
  "Authorization cancelled.": "التصريح ملغى.",
  "Authorization rejected.": "التصريح مرفوض.",
  "Authorization expired.": "التصريح منتهي.",
  "Authorization is not approved.": "التصريح غير معتمد.",
  "Authorization details are not valid.": "بيانات التصريح غير صالحة.",
  "Required vehicle or requester is unavailable.": "بيانات المركبة أو مقدّم الطلب غير متوفرة.",
  "Authorization usage rule is not valid.": "قاعدة استخدام التصريح غير صالحة.",
  "Authorization not yet valid.": "التصريح لم يبدأ بعد.",
  "Approved for after-hours use.": "معتمد للاستخدام بعد ساعات العمل.",
  "Unable to verify authorization. Please try again later.": "تعذّر التحقق من التصريح. يرجى المحاولة لاحقًا.",

  // Database trigger messages surfaced via pgErrorMessage
  "Only admins can change user roles": "يمكن لمسؤولي النظام فقط تغيير أدوار المستخدمين",
  "Only admins can change user active status": "يمكن لمسؤولي النظام فقط تغيير حالة تفعيل المستخدمين",

  // lib/vehicles/identity presentation fallbacks
  "Plate unavailable": "رقم اللوحة غير متوفر",
  "Door No. unavailable": "رقم الباب غير متوفر",
};

const LIMIT_LABELS_AR: Record<string, string> = {
  "up to 3 months (90 days)": "حتى 3 أشهر (90 يومًا)",
  "1 day, or custom up to 1 month (30 days)": "يوم واحد، أو مدة مخصصة حتى شهر (30 يومًا)",
  "once every 3 months": "مرة كل 3 أشهر",
  "once every day": "مرة كل يوم",
};

const MONTHS_AR: Record<string, string> = {
  Jan: "يناير",
  Feb: "فبراير",
  Mar: "مارس",
  Apr: "أبريل",
  May: "مايو",
  Jun: "يونيو",
  Jul: "يوليو",
  Aug: "أغسطس",
  Sep: "سبتمبر",
  Sept: "سبتمبر",
  Oct: "أكتوبر",
  Nov: "نوفمبر",
  Dec: "ديسمبر",
};

function limitLabel(label: string): string {
  return LIMIT_LABELS_AR[label] ?? label;
}

/** "05 Nov 2026" (en-GB short) → "05 نوفمبر 2026"; anything else unchanged. */
function shortDate(value: string): string {
  const match = /^(\d{1,2}) ([A-Za-z]{3,4}) (\d{4})$/.exec(value);
  const month = match ? MONTHS_AR[match[2]!] : undefined;
  return match && month ? `${match[1]} ${month} ${match[3]}` : value;
}

const PATTERNS_AR: Array<[RegExp, (...groups: string[]) => string]> = [
  [/^Valid only after (\d{2}:\d{2}) Saudi time\.$/, (time) => `صالح فقط بعد الساعة ${time} بتوقيت السعودية.`],
  // lib/authorizations/limits
  [
    /^Your role allows authorizations of (.+)\. Shorten the date range\.$/,
    (label) => `يسمح دورك بتصاريح مدتها ${limitLabel(label)}. يرجى تقصير نطاق التواريخ.`,
  ],
  [
    /^Your role can submit a request (.+)\. The next request is available on (\d{4}-\d{2}-\d{2})\.$/,
    (cadence, date) => `يمكن لدورك تقديم طلب ${limitLabel(cadence)}. الطلب التالي متاح بتاريخ ${date}.`,
  ],
  // lib/authorizations/overlap
  [
    /^Vehicle has an active authorization for (.+) until (.+)\.$/,
    (who, until) => `لدى المركبة تصريح نشط لـ ${who} حتى ${shortDate(until)}.`,
  ],
  // Database triggers (request limits)
  [
    /^This category allows authorizations of up to (\d+) day\(s\); requested (\d+) day\(s\)\.$/,
    (max, requested) => `تسمح هذه الفئة بتصاريح حتى ${max} يوم؛ المدة المطلوبة ${requested} يوم.`,
  ],
  [
    /^This category allows one request every (\d+) day\(s\)\. Next request allowed on (\d{4}-\d{2}-\d{2})\.$/,
    (days, date) => `تسمح هذه الفئة بطلب واحد كل ${days} يوم. الطلب التالي مسموح بتاريخ ${date}.`,
  ],
  // zod built-in defaults (string length / type / enum)
  [/^Too big: expected string to have <=?(\d+) characters?$/, (max) => `النص طويل جدًا (الحد الأقصى ${max} حرفًا).`],
  [/^Too small: expected string to have >=?(\d+) characters?$/, (min) => `النص قصير جدًا (الحد الأدنى ${min} حرفًا).`],
  [/^Invalid input: .+$/, () => "مدخلات غير صالحة"],
  [/^Invalid option: .+$/, () => "خيار غير صالح"],
];

export function translateMessage(locale: Locale, message: string): string {
  if (locale !== "ar" || !message) return message;
  const exact = EXACT_AR[message];
  if (exact) return exact;
  for (const [pattern, render] of PATTERNS_AR) {
    const match = pattern.exec(message);
    if (match) return render(...match.slice(1));
  }
  return message;
}
