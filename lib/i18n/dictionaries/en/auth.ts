export const authEn = {
  metadata: {
    forgotPassword: "Forgot password",
    resetPassword: "Reset password",
    changePassword: "Change password",
  },
  loginPage: {
    intro: "Sign-in is for administrators and logistics approvers. Employees can",
    submitRequest: "submit a request",
    or: "or",
    trackByBadge: "track requests by badge",
    withoutAccount: "without an account.",
  },
  login: {
    title: "Light Vehicles Authorization",
    subtitle: "Secure after-hours fleet access for Bin Quraya.",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot password?",
    passwordReset: "Password updated. Sign in with your new password.",
    sessionError: "Session check failed. Sign in again.",
    failed: "Sign-in failed",
    submitting: "Signing in…",
    submit: "Sign in",
  },
  forgot: {
    title: "Forgot password",
    description:
      "Enter the email for your LVAS account. If it can sign in, we will send a link to choose a new password.",
    sent: "If this email can sign in, a reset link is on its way. The link expires in 30 minutes.",
    notConfigured:
      "Password reset email is not configured on this server yet. Contact the fleet administrator.",
    email: "Email",
    submitting: "Sending…",
    submit: "Send reset link",
    backToSignIn: "Back to sign in",
  },
  reset: {
    title: "Choose a new password",
    description: "Use at least 8 characters. This link works once.",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    submitting: "Saving…",
    submit: "Update password",
    backToSignIn: "Back to sign in",
    invalidTitle: "This reset link is invalid",
    invalidDescription: "Request a new link from the sign-in page.",
    forgotPasswordLink: "Forgot password",
  },
  change: {
    title: "Change password",
    description:
      "Enter your current password, then choose a new one. This replaces the shared temporary password for your account only.",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    hint: "Use at least 8 characters.",
    submitting: "Saving…",
    submit: "Update password",
    success: "Password updated",
  },
  signOut: {
    submitting: "Signing out…",
    submit: "Sign out",
    failed: "Sign out failed",
  },
} as const;

export type AuthDictionary = typeof authEn;
