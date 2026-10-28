// Actual release-cleanup components with deterministic hook state; no HTTP/DB/email.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
const stub = name => Object.assign(() => null, { displayName: name });
function harness(file, exportName, props) {
  const state = [], effects = [], modules = new Map();
  const storage = new Map();
  let cursor = 0, changed = false, tree;
  const env = { pathname: "/vehicles", server: false, deferred: undefined };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], value => {
        const next = typeof value === "function" ? value(state[index]) : value;
        if (!Object.is(next, state[index])) { state[index] = next; changed = true; }
      }];
    },
    useEffect: fn => effects.push(fn),
    useMemo: fn => fn(),
    useDeferredValue: value => env.deferred === undefined ? value : env.deferred,
    useTransition: () => [false, fn => fn()],
    useSyncExternalStore: (_subscribe, snapshot, serverSnapshot) => env.server ? serverSnapshot() : snapshot(),
  };
  const load = relative => {
    if (modules.has(relative)) return modules.get(relative);
    const cjs = { exports: {} };
    const require = name => {
      if (name === "react") return hooks;
      if (name === "next/navigation") return {
        usePathname: () => env.pathname, useRouter: () => ({ replace() {} }),
        useSearchParams: () => new URLSearchParams(),
      };
      if (name === "@/components/dashboard/table-pagination") return {
        PAGE_SIZES: [25, 50, 100], TablePagination: stub("TablePagination"),
      };
      if (name === "@/components/vehicles/plate-label") return load("components/vehicles/plate-label.tsx");
      if (name.startsWith("@/components/")) return new Proxy({}, { get: (_obj, key) => stub(String(key)) });
      if (name.startsWith("@/actions/")) return {};
      if (name === "@/lib/i18n/client") return {
        useI18n: () => ({
          locale: "en", dir: "ltr", intl: "en-GB", tm: message => message,
          t: load("lib/i18n/dictionaries/index.ts").getDictionary("en"),
        }),
      };
      if (name.startsWith("@/")) {
        const stem = name.slice(2);
        return load([stem + ".ts", stem + ".tsx", stem + "/index.ts"]
          .find(candidate => existsSync(path.join(root, candidate))) ?? stem + ".ts");
      }
      return nativeRequire(name);
    };
    vm.runInNewContext(ts.transpileModule(readFileSync(path.join(root, relative), "utf8"), {
      fileName: relative, compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    }).outputText, {
      module: cjs, exports: cjs.exports, require, URLSearchParams,
      window: { localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      } },
      setTimeout, clearTimeout,
    });
    modules.set(relative, cjs.exports);
    return cjs.exports;
  };
  const component = load(file)[exportName];
  function render(nextProps = props) {
    props = nextProps;
    let passes = 0;
    do {
      assert(++passes < 10, "Render-phase updates must settle");
      changed = false; cursor = 0; effects.length = 0;
      tree = component(props);
    } while (changed);
    return tree;
  }
  function nodes(node = tree) {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(child => nodes(child ?? null));
    return [node, ...nodes(node.props?.children ?? null)];
  }
  const find = name => nodes().find(n => n.type?.displayName === name);
  return { env, storage, state, render, nodes, find, effects };
}
const vehicles = Array.from({ length: 80 }, (_, i) => ({
  id: String(i), door_number: `006-01-${i}`, plate_number: `TEST-${i}`,
  make: "Toyota", model: "Synthetic", color: null, year: 2021, is_active: i % 2 === 0,
}));
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS: " + name); }
test("Employee draft survives typing and synchronizes only when URL query changes", () => {
  const props = { employees: [], total: 0, page: 1, pageSize: 25, query: "old", role: "all",
    counts: { all: 0, manager_requester: 0, supervisor_requester: 0, other_employee: 0 } };
  const h = harness("components/employees/employees-browser.tsx", "EmployeesBrowser", props);
  h.render(); h.find("Input").props.onChange({ target: { value: "draft" } }); h.render();
  assert.equal(h.find("Input").props.value, "draft");
  h.render({ ...props, query: "new" });
  assert.equal(h.find("Input").props.value, "new");
  assert.equal(h.effects.length, 1, "Existing debounce effect retained");
});
for (const [file, name] of [["vehicle-directory", "VehicleDirectory"], ["vehicles-admin-table", "VehiclesAdminTable"]]) {
  test(`${name}: deferred search and page-size changes reset pagination, ordinary renders do not`, () => {
    const h = harness(`components/vehicles/${file}.tsx`, name, { vehicles });
    h.env.deferred = "";
    h.render(); h.find("TablePagination").props.onPageChange(2); h.render();
    assert.equal(h.find("TablePagination").props.page, 2);
    h.find("Input").props.onChange({ target: { value: "Toyota" } }); h.render();
    assert.equal(h.find("TablePagination").props.page, 2, "Raw typing must not reset before deferred search");
    h.env.deferred = "Toyota"; h.render();
    assert.equal(h.find("TablePagination").props.page, 1);
    h.find("TablePagination").props.onPageChange(2); h.render();
    h.find("TablePagination").props.onPageSizeChange(50); h.render();
    assert.equal(h.find("TablePagination").props.page, 1);
    assert.equal(h.find("TablePagination").props.pageSize, 50);
  });
}
test("Admin active/inactive filtering still resets pagination", () => {
  const h = harness("components/vehicles/vehicles-admin-table.tsx", "VehiclesAdminTable", { vehicles });
  h.render(); h.find("TablePagination").props.onPageChange(2); h.render();
  const active = h.nodes().find(n => n.type === "button" && n.props.children?.[0] === "Active");
  assert(active); active.props.onClick(); h.render();
  assert.equal(h.find("TablePagination").props.page, 1);
  assert.equal(h.find("TablePagination").props.total, 40);
});
test("Sidebar restores stored collapse after hydration, toggles persist, and route changes close the mobile menu", () => {
  const h = harness("components/layout/app-shell.tsx", "AppShell", {
    profile: { full_name: "Synthetic Admin", email: "admin@example.invalid", role: "admin" },
    pendingCount: 0, children: null,
  });
  h.storage.set("lvas-sidebar-collapsed", "1");
  h.env.server = true; h.render();
  assert.equal(h.state[0], null, "Server snapshot remains expanded/hydration-safe");
  h.env.server = false; h.render();
  assert.equal(h.state[0], true);
  // Toggle handler is the only button that writes the collapse preference.
  const toggle = h.nodes().find(n => n.props?.onClick?.name === "toggleCollapsed");
  assert(toggle); toggle.props.onClick(); h.render();
  assert.equal(h.state[0], false); assert.equal(h.storage.get("lvas-sidebar-collapsed"), "0");
  const menu = h.nodes().find(n => n.type?.displayName === "Button" && n.props.onClick &&
    n.props.className?.includes("md:hidden"));
  assert(menu); menu.props.onClick(); h.render();
  assert.equal(h.state[1], true);
  h.env.pathname = "/history"; h.render();
  assert.equal(h.state[1], false);
  h.env.pathname = "/vehicles"; h.render();
  assert.equal(h.state[1], false, "Back navigation must not reopen an old menu");
  assert.equal(h.effects.length, 0);
});
console.log(`Release UI state: ${passed} PASS.`);
