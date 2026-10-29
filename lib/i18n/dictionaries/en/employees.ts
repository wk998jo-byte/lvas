export const employeesEn = {
  page: {
    title: "Employees",
    loadFailed: (message: string) => `Failed to load employees: ${message}`,
    unknownError: "Unknown error",
    hrDirectory: "HR directory",
    description:
      "Imported from the HR master sheet. These records are a reference directory — they are not login accounts.",
    total: "Total",
    managers: "Managers",
    supervisors: "Supervisors",
  },
  browser: {
    filterAll: "All",
    filterManagers: "Managers",
    filterSupervisors: "Supervisors",
    filterOther: "Other employees",
    searchPlaceholder: "Search badge, name, ID, mobile, department, position…",
    matching: (total: number) => `matching employee${total === 1 ? "" : "s"}`,
    noMatchingTitle: "No matching employees",
    noEmployeesTitle: "No employees yet",
    noMatchingDescription: "Try another badge, name, department, or position.",
    noEmployeesDescription: "Run the employee import script to populate the directory.",
    badge: "Badge",
    name: "Name",
    department: "Department",
    position: "Position",
    category: "Category",
    mobile: "Mobile",
    showing: "Showing",
    of: "of",
    rows: "Rows",
    previous: "Previous",
    next: "Next",
  },
} as const;

export type EmployeesDictionary = typeof employeesEn;
