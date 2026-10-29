import type { AuthDictionary } from "@/lib/i18n/dictionaries/en/auth";
import type { Translation } from "@/lib/i18n/types";

export const authAr: Translation<AuthDictionary> = {
  metadata: {
    forgotPassword: "نسيت كلمة المرور",
    resetPassword: "إعادة تعيين كلمة المرور",
    changePassword: "تغيير كلمة المرور",
  },
  loginPage: {
    intro: "تسجيل الدخول مخصص لمسؤولي النظام ومعتمدي اللوجستيات. يمكن للموظفين",
    submitRequest: "تقديم طلب",
    or: "أو",
    trackByBadge: "متابعة الطلبات بالرقم الوظيفي",
    withoutAccount: "دون الحاجة إلى حساب.",
  },
  login: {
    title: "نظام تصاريح المركبات الخفيفة",
    subtitle: "وصول آمن إلى مركبات الأسطول بعد ساعات العمل لشركة بن قريعة.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    forgotPassword: "نسيت كلمة المرور؟",
    passwordReset: "تم تحديث كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.",
    sessionError: "تعذّر التحقق من الجلسة. سجّل الدخول مرة أخرى.",
    failed: "تعذّر تسجيل الدخول",
    submitting: "جارٍ تسجيل الدخول…",
    submit: "تسجيل الدخول",
  },
  forgot: {
    title: "نسيت كلمة المرور",
    description:
      "أدخل البريد الإلكتروني لحسابك في LVAS. إذا كان الحساب مخوّلًا بتسجيل الدخول، فسنرسل إليك رابطًا لاختيار كلمة مرور جديدة.",
    sent: "إذا كان هذا البريد مخوّلًا بتسجيل الدخول، فسيصلك رابط إعادة التعيين قريبًا. تنتهي صلاحية الرابط خلال 30 دقيقة.",
    notConfigured:
      "لم يتم إعداد بريد إعادة تعيين كلمة المرور على هذا الخادم بعد. تواصل مع مسؤول الأسطول.",
    email: "البريد الإلكتروني",
    submitting: "جارٍ الإرسال…",
    submit: "إرسال رابط إعادة التعيين",
    backToSignIn: "العودة إلى تسجيل الدخول",
  },
  reset: {
    title: "اختر كلمة مرور جديدة",
    description: "استخدم 8 أحرف على الأقل. يعمل هذا الرابط مرة واحدة فقط.",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور الجديدة",
    submitting: "جارٍ الحفظ…",
    submit: "تحديث كلمة المرور",
    backToSignIn: "العودة إلى تسجيل الدخول",
    invalidTitle: "رابط إعادة التعيين هذا غير صالح",
    invalidDescription: "اطلب رابطًا جديدًا من صفحة تسجيل الدخول.",
    forgotPasswordLink: "نسيت كلمة المرور",
  },
  change: {
    title: "تغيير كلمة المرور",
    description:
      "أدخل كلمة المرور الحالية، ثم اختر كلمة مرور جديدة. يستبدل ذلك كلمة المرور المؤقتة المشتركة لحسابك فقط.",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور الجديدة",
    hint: "استخدم 8 أحرف على الأقل.",
    submitting: "جارٍ الحفظ…",
    submit: "تحديث كلمة المرور",
    success: "تم تحديث كلمة المرور",
  },
  signOut: {
    submitting: "جارٍ تسجيل الخروج…",
    submit: "تسجيل الخروج",
    failed: "تعذّر تسجيل الخروج",
  },
};
