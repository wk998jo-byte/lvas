/** Strings only: the dashboard layout passes this group to the client app shell. */
export const shellEn = {
  nav: {
    dashboard: "Dashboard",
    history: "Requests history",
    vehicles: "Vehicles",
    employees: "Employees",
  },
  crumbs: {
    home: "Home",
    details: "Details",
    admin: "Admin",
  },
  titles: {
    dashboard: "Dashboard",
    authorizationDetails: "Authorization details",
    history: "Requests history",
    vehicleDetails: "Vehicle details",
    vehicles: "Vehicles",
    changePassword: "Change password",
    employees: "Employees",
  },
  breadcrumb: "Breadcrumb",
  collapse: "Collapse",
  closeMenu: "Close menu",
  userMenu: {
    accountMenu: "Account menu",
    userFallback: "User",
    changePassword: "Change password",
    signingOut: "Signing out…",
    signOut: "Sign out",
  },
} as const;

export type ShellDictionary = typeof shellEn;
